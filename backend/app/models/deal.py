import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum as SAEnum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class DealStatus(str, enum.Enum):
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class Deal(Base):
    __tablename__ = "deals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    value = Column(Float, default=0.0, nullable=False)
    stage = Column(SAEnum(DealStatus), default=DealStatus.NEGOTIATION, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    lead = relationship("Lead", back_populates="deals")

    def __repr__(self) -> str:
        return f"<Deal {self.name} (${self.value:.2f})>"
