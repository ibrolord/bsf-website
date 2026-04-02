from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ParsedComponent(BaseModel):
    name: str
    component_type: Literal["process", "data_store", "external_entity"]
    confidence: float = Field(ge=0.0, le=1.0)
    description: str = ""


class ParsedFlow(BaseModel):
    source: str
    target: str
    label: str = ""
    confidence: float = Field(ge=0.0, le=1.0)


class ParsedBoundary(BaseModel):
    name: str
    contains: list[str]


class DocumentParseResult(BaseModel):
    components: list[ParsedComponent]
    flows: list[ParsedFlow]
    boundaries: list[ParsedBoundary]
    raw_text_excerpt: str = ""


class DocumentUploadResponse(BaseModel):
    document_id: UUID
    filename: str
    page_count: int
    parse_result: DocumentParseResult
