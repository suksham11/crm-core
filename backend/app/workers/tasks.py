import logging
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.lead import Lead
from app.models.task import Task, TaskType, TaskStatus
from app.services.notification_service import send_email, send_whatsapp

logger = logging.getLogger(__name__)


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

        # Dispatch notification
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
