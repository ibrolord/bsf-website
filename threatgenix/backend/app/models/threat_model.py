import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ThreatModel(Base):
    __tablename__ = "threat_models"
    __table_args__ = (
        CheckConstraint(
            "data_classification IN ('Public', 'Internal', 'Confidential', 'Restricted')",
            name="ck_threat_models_data_classification",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    system_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    data_classification: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    documents = relationship("Document", back_populates="threat_model", cascade="all, delete-orphan")
    nodes = relationship("DFDNode", back_populates="threat_model", cascade="all, delete-orphan")
    edges = relationship("DFDEdge", back_populates="threat_model", cascade="all, delete-orphan")
    trust_boundaries = relationship("TrustBoundary", back_populates="threat_model", cascade="all, delete-orphan")
    threats = relationship("Threat", back_populates="threat_model", cascade="all, delete-orphan")
