import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum as SAEnum, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class TaskType(str, enum.Enum):
    FOLLOW_UP = "follow_up"
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    OTHER = "other"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    task_type = Column(SAEnum(TaskType), default=TaskType.FOLLOW_UP, nullable=False)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    lead = relationship("Lead", back_populates="tasks")

    def __repr__(self) -> str:
        return f"<Task {self.title} ({self.status.value})>"
