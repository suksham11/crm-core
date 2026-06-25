import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum as SAEnum, Text, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    WON = "won"
    LOST = "lost"


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        UniqueConstraint("email", "phone", name="uq_leads_email_phone"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(120), nullable=False)
    last_name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(30), nullable=False, index=True)
    company = Column(String(255), nullable=True)
    status = Column(SAEnum(LeadStatus), default=LeadStatus.NEW, nullable=False)
    source = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    deals = relationship("Deal", back_populates="lead", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="lead", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Lead {self.first_name} {self.last_name} ({self.email})>"
