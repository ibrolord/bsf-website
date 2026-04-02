from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class ThreatResponse(BaseModel):
    id: UUID
    display_id: str
    description: str
    stride_category: str
    threat_subtype: Optional[str] = None
    severity: str
    source: str
    status: str
    dismiss_reason: Optional[str]
    rule_id: Optional[str]
    ai_enhanced: bool
    original_rule_threat_id: Optional[UUID]
    affected_node_ids: list[UUID]
    affected_edge_ids: list[UUID]
    compliance_controls: list["ComplianceControlRef"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalyzeResponse(BaseModel):
    threats: list[ThreatResponse]
    ai_skipped_reason: Optional[str] = None


class ThreatSummary(BaseModel):
    total: int
    by_stride: dict[str, int]  # {"Spoofing": 3, "Tampering": 5, ...}
    by_severity: dict[str, int]  # {"Critical": 1, "High": 4, ...}
    by_status: dict[str, int]  # {"Open": 8, "Accepted": 2, ...}


class ThreatTriageRequest(BaseModel):
    status: Literal["Accepted", "Dismissed"]
    dismiss_reason: Optional[str] = None


class ComplianceControlRef(BaseModel):
    nist_control_id: str
    nist_control_name: str
