from pydantic import BaseModel


class ComplianceMappingResponse(BaseModel):
    id: int
    stride_category: str
    threat_subtype: str
    nist_control_id: str
    nist_control_name: str

    model_config = {"from_attributes": True}
