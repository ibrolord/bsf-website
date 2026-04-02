import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("threat_models.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[Optional[str]] = mapped_column(Text)
    parsed_components: Mapped[Optional[dict]] = mapped_column(JSONB)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    parsed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    threat_model = relationship("ThreatModel", back_populates="documents")
