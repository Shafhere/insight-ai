from typing import Any

from pydantic import BaseModel, Field


class ColumnProfile(BaseModel):
    name: str
    data_type: str
    semantic_type: str

    missing_count: int
    missing_percentage: float

    unique_count: int

    sample_values: list[Any] = Field(default_factory=list)

    statistics: dict[str, Any] = Field(default_factory=dict)


class DatasetProfile(BaseModel):
    dataset_id: str
    filename: str
    file_type: str

    rows: int
    columns: int

    duplicate_rows: int

    missing_cells: int
    missing_percentage: float

    quality_score: float

    detected_domain: str
    domain_confidence: str

    column_profiles: list[ColumnProfile]

    warnings: list[str] = Field(default_factory=list)


class DatasetUploadResponse(BaseModel):
    message: str
    dataset: DatasetProfile