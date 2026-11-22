
from typing import Any

from pydantic import BaseModel, Field


class DecisionReport(BaseModel):
    dataset_id: str
    source: str
    executive_summary: str
    business_narrative: dict[str, str] = Field(default_factory=dict)
    findings: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
