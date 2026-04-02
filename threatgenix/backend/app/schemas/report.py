from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.threat import ComplianceControlRef, ThreatResponse


class ReportRequest(BaseModel):
    threat_model_id: UUID
    dfd_image_base64: str = ""


class ReportData(BaseModel):
    system_name: str
    description: str
    data_classification: str
    created_at: datetime
    generated_at: datetime
    dfd_image_base64: str
    threats: list[ThreatResponse]
    compliance_summary: list[ComplianceControlRef]
    methodology_text: str
