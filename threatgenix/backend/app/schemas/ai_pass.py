from typing import Optional

from pydantic import BaseModel

from app.schemas.dfd import DFDResponse
from app.schemas.threat import ThreatResponse


class AIPassInput(BaseModel):
    dfd: DFDResponse
    rules_threats: list[ThreatResponse]
    doc_excerpt: str
    system_name: str
    data_classification: str


class AIThreatRaw(BaseModel):
    description: str
    stride_category: str
    severity: str
    enhances_rule_threat_id: Optional[str] = None
    reasoning: str


class AIPassOutput(BaseModel):
    threats: list[AIThreatRaw]
    model_id: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
