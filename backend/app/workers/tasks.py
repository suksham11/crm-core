import asyncio
import logging
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.lead import Lead, LeadStatus
from app.models.task import Task, TaskType, TaskStatus
from app.services.notification_service import send_email, send_whatsapp

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _send_notification(lead: Lead, subject: str, body: str) -> bool:
    """Try email first, fall back to WhatsApp. Log if neither configured."""
    sent = False
    if lead.email:
        try:
            sent = asyncio.run(send_email(lead.email, subject, body))
        except Exception as e:
            logger.error("Email failed for %s: %s", lead.email, e)
    if not sent and lead.phone:
        try:
            sent = asyncio.run(send_whatsapp(lead.phone, body))
        except Exception as e:
            logger.error("WhatsApp failed for %s: %s", lead.phone, e)
    if not sent:
        logger.info("Notification logged (no channel): to=%s subject=%s", lead.email or lead.phone, subject)
    return sent


# ---------------------------------------------------------------------------
# New task: 24-hour follow-up (runs once via countdown=86400)
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60, acks_late=True)
def notify_follow_up_24h(self, lead_id: str):
    """Executed 24 hours after lead creation via Celery countdown."""
    logger.info("Running 24h follow-up check for lead %s", lead_id)
    db: Session = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead or not lead.is_active:
            logger.info("Lead %s deleted; skipping 24h follow-up", lead_id)
            return {"status": "skipped", "reason": "lead deleted"}

        if lead.status != LeadStatus.NEW:
            logger.info("Lead %s progressed to %s; skipping 24h follow-up", lead_id, lead.status.value)
            return {"status": "skipped", "reason": f"status is {lead.status.value}"}

        subject = f"Follow-up: {lead.first_name} {lead.last_name}"
        body = (
            f"Hi {lead.first_name},\n\n"
            f"This is a follow-up regarding your recent inquiry. "
            f"Please let us know if you have any questions."
        )
        sent = _send_notification(lead, subject, body)
        logger.info("24h follow-up for lead %s: %s", lead_id, "sent" if sent else "no channel")
        return {"status": "sent" if sent else "no_channel", "lead_id": lead_id}
    except Exception as exc:
        logger.error("Failed 24h follow-up for lead %s: %s", lead_id, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# New task: stage-change notification
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def notify_stage_change(self, lead_id: str, old_status: str, new_status: str):
    """Fired when a lead's status field is updated."""
    logger.info("Stage change for lead %s: %s -> %s", lead_id, old_status, new_status)
    db: Session = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead or not lead.is_active:
            logger.info("Lead %s gone; skipping stage-change notification", lead_id)
            return {"status": "skipped", "reason": "lead deleted"}

        subject = f"Lead {lead.first_name} {lead.last_name} moved to {new_status}"
        body = (
            f"Hi {lead.first_name},\n\n"
            f"Your lead status has been updated from {old_status} to {new_status}."
        )
        sent = _send_notification(lead, subject, body)
        logger.info("Stage-change notification for lead %s: %s", lead_id, "sent" if sent else "no channel")
        return {"status": "sent" if sent else "no_channel", "lead_id": lead_id}
    except Exception as exc:
        logger.error("Failed stage-change notification for lead %s: %s", lead_id, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Legacy tasks (kept for backward compatibility)
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def schedule_follow_up(self, lead_id: str):
    db: Session = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead or not lead.is_active:
            logger.info(f"Lead {lead_id} is gone; skipping follow-up")
            return {"status": "skipped", "reason": "lead deleted"}

        follow_up_at = datetime.now(timezone.utc) + timedelta(hours=24)
        task = Task(
            lead_id=lead.id,
            task_type=TaskType.FOLLOW_UP,
            status=TaskStatus.PENDING,
            title=f"Follow-up with {lead.first_name} {lead.last_name}",
            description=f"Automated 24-hour follow-up for lead from {lead.source or 'unknown source'}",
            scheduled_at=follow_up_at,
        )
        db.add(task)
        db.commit()

        logger.info(f"Scheduled follow-up for lead {lead_id} at {follow_up_at.isoformat()}")
        return {"status": "scheduled", "lead_id": lead_id, "follow_up_at": follow_up_at.isoformat()}
    except Exception as exc:
        logger.error(f"Failed to schedule follow-up for {lead_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def execute_follow_up(self, task_id: str):
    db: Session = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task or task.status != TaskStatus.PENDING:
            return {"status": "skipped", "reason": "task not found or already completed"}

        lead = db.query(Lead).filter(Lead.id == task.lead_id).first()
        if not lead or not lead.is_active:
            task.status = TaskStatus.CANCELLED
            db.commit()
            logger.info(f"Cancelled task {task_id}: parent lead deleted")
            return {"status": "cancelled", "reason": "lead deleted"}

        subject = f"Follow-up: {lead.first_name} {lead.last_name}"
        body = f"Hi {lead.first_name},\n\nThis is a follow-up regarding your recent inquiry."
        sent = False
        if lead.email:
            sent = await_email(subject, body, lead.email)
        if lead.phone and not sent:
            sent = await_whatsapp(lead.phone, body)

        task.status = TaskStatus.COMPLETED if sent else TaskStatus.PENDING
        task.completed_at = datetime.now(timezone.utc) if sent else None
        db.commit()

        return {"status": "completed" if sent else "pending", "lead_id": str(lead.id)}
    except Exception as exc:
        logger.error(f"Failed to execute follow-up {task_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


def await_email(subject: str, body: str, to: str) -> bool:
    import asyncio
    try:
        return asyncio.run(send_email(to, subject, body))
    except Exception:
        return False


def await_whatsapp(to: str, message: str) -> bool:
    import asyncio
    try:
        return asyncio.run(send_whatsapp(to, message))
    except Exception:
        return False
