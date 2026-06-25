from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.lead import Lead, LeadStatus
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.lead import LeadCreate


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit() or c in "+")
    if not digits.startswith("+"):
        digits = "+1" + digits if digits.startswith("1") else "+" + digits
    return digits


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def create_lead(db: Session, payload: LeadCreate) -> Lead:
    email_norm = _normalize_email(payload.email)
    phone_norm = _normalize_phone(payload.phone)

    existing = db.query(Lead).filter(
        func.lower(Lead.email) == email_norm,
        Lead.phone == phone_norm,
    ).first()

    if existing:
        for field, value in payload.model_dump(exclude={"email", "phone"}).items():
            if value is not None:
                setattr(existing, field, value)
        existing.email = email_norm
        existing.phone = phone_norm
        db.commit()
        db.refresh(existing)
        return existing

    lead = Lead(
        first_name=payload.first_name.strip().title(),
        last_name=payload.last_name.strip().title(),
        email=email_norm,
        phone=phone_norm,
        company=payload.company,
        source=payload.source,
        notes=payload.notes,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def update_lead_status(db: Session, lead: Lead, new_status: LeadStatus, user: User) -> Lead:
    old_status = lead.status
    lead.status = new_status
    db.add(AuditLog(
        user_id=user.id,
        entity_type="lead",
        entity_id=str(lead.id),
        action=f"status_changed:{old_status.value}->{new_status.value}",
    ))
    return lead
