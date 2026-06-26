import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from fastapi import UploadFile, File

from app.config import get_settings
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.lead import LeadCreate, LeadUpdate, LeadResponse, LeadListResponse, LeadBulkStatusUpdate
from app.api.deps import get_current_user, require_role
from app.services.lead_service import create_lead, update_lead_status
from app.services.csv_service import parse_csv, bulk_insert_leads
from app.workers.tasks import notify_follow_up_24h, notify_stage_change

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead_endpoint(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = create_lead(db, payload)
    db.add(AuditLog(user_id=current_user.id, entity_type="lead", entity_id=str(lead.id), action="created"))
    db.commit()

    try:
        notify_follow_up_24h.apply_async(args=[str(lead.id)], countdown=86400)
    except Exception:
        if settings.environment == "development":
            logger.warning("Redis/Celery unavailable — 24h follow-up skipped for lead %s", lead.id)
        else:
            logger.exception("Failed to enqueue 24h follow-up for lead %s", lead.id)

    return lead


@router.get("", response_model=LeadListResponse)
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    status_filter: LeadStatus | None = Query(None, alias="status"),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Lead).filter(Lead.is_active == True)

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(Lead.first_name.ilike(like), Lead.last_name.ilike(like), Lead.email.ilike(like), Lead.phone.ilike(like))
        )

    if status_filter:
        query = query.filter(Lead.status == status_filter)

    sort_col = getattr(Lead, sort_by, Lead.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return LeadListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_active == True).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_active == True).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    update_data = payload.model_dump(exclude_unset=True)
    old_status = lead.status.value if "status" in update_data else None
    if "status" in update_data:
        lead = update_lead_status(db, lead, LeadStatus(update_data["status"]), current_user)
        del update_data["status"]
    for field, value in update_data.items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)

    if old_status is not None and old_status != lead.status.value:
        try:
            notify_stage_change.delay(str(lead.id), old_status, lead.status.value)
        except Exception:
            logger.exception("Failed to enqueue stage-change notification for lead %s", lead.id)

    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    db.add(AuditLog(user_id=current_user.id, entity_type="lead", entity_id=str(lead_id), action="deleted"))
    db.delete(lead)
    db.commit()


@router.post("/bulk-ingest", status_code=status.HTTP_201_CREATED)
def bulk_ingest_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    content = file.file.read().decode("utf-8")
    leads = parse_csv(content)
    count = bulk_insert_leads(db, leads)
    return {"ingested": count, "filename": file.filename}


@router.post("/bulk-status", response_model=list[LeadResponse])
def bulk_update_status(
    payload: LeadBulkStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    leads = db.query(Lead).filter(Lead.id.in_(payload.lead_ids), Lead.is_active == True).all()
    if not leads:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No leads found")
    for lead in leads:
        update_lead_status(db, lead, payload.status, current_user)
    db.commit()
    return leads
