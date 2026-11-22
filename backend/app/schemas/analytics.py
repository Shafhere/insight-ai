
from typing import Any, Literal

from pydantic import BaseModel, Field

DatasetSource = Literal["original", "cleaned"]


class Metric(BaseModel):
    name: str
    value: Any
    description: str


class AnalyticsOverview(BaseModel):
    dataset_id: str
    source: DatasetSource
    rows: int
    columns: int
    missing_cells: int
    duplicate_rows: int
    metrics: list[Metric] = Field(default_factory=list)
    numeric_summary: list[dict[str, Any]] = Field(default_factory=list)
    categorical_columns: list[str] = Field(default_factory=list)
    date_columns: list[str] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)


class BreakdownResponse(BaseModel):
    dataset_id: str
    group_by: str
    metric: str | None
    aggregation: str
    results: list[dict[str, Any]]


class TrendResponse(BaseModel):
    dataset_id: str
    date_column: str
    metric: str
    frequency: str
    results: list[dict[str, Any]]


class CorrelationResponse(BaseModel):
    dataset_id: str
    columns: list[str]
    matrix: list[list[float | None]]
    strong_relationships: list[dict[str, Any]]
