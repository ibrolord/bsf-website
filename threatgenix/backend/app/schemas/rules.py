from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class RuleDefinition(BaseModel):
    rule_id: str
    stride_category: str
    threat_subtype: str
    description_template: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    requires_boundary_crossing: bool = True


class GeneratedThreat(BaseModel):
    rule_id: str
    display_id: str
    stride_category: str
    threat_subtype: str
    severity: str
    description: str
    affected_node_ids: list[str]
    affected_edge_ids: list[str]
    source: str = "Rules"


class RuleEngineOutput(BaseModel):
    threats: list[GeneratedThreat]
    execution_time_ms: float
    rules_evaluated: int
    rules_fired: int
