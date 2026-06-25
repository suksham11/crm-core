from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.models.lead import LeadStatus


class LeadCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    company: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit() or c in "+")
        if not digits.startswith("+"):
            digits = "+1" + digits if digits.startswith("1") else "+" + digits
        return digits

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip().title()


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None


class LeadBulkStatusUpdate(BaseModel):
    lead_ids: list[UUID]
    status: LeadStatus


class LeadResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: str
    company: Optional[str] = None
    status: LeadStatus
    source: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadListResponse(BaseModel):
    items: list[LeadResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
