from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ThreatModelCreate(BaseModel):
    system_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=500)
    data_classification: Literal["Public", "Internal", "Confidential", "Restricted"]


class ThreatModelResponse(BaseModel):
    id: UUID
    system_name: str
    description: str
    data_classification: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThreatModelListItem(BaseModel):
    id: UUID
    system_name: str
    data_classification: str
    created_at: datetime
    updated_at: datetime
    threat_count: int = 0

    model_config = {"from_attributes": True}
