
from typing import Literal

from pydantic import BaseModel, Field

CleaningStrategy = Literal["median", "mean", "mode", "drop_rows", "leave"]
OutlierStrategy = Literal["keep", "cap_iqr"]


class CleaningRecommendation(BaseModel):
    column: str
    missing_count: int
    suggested_strategy: CleaningStrategy
    reason: str


class OutlierProfile(BaseModel):
    column: str
    outlier_count: int
    lower_bound: float
    upper_bound: float


class CleaningPreviewResponse(BaseModel):
    dataset_id: str
    rows: int
    columns: int
    missing_cells: int
    duplicate_rows: int
    recommendations: list[CleaningRecommendation]
    outliers: list[OutlierProfile]
    notes: list[str] = Field(default_factory=list)


class CleaningApplyRequest(BaseModel):
    column_strategies: dict[str, CleaningStrategy] = Field(
        default_factory=dict
    )
    remove_duplicates: bool = True
    outlier_strategies: dict[str, OutlierStrategy] = Field(
        default_factory=dict
    )


class CleaningApplyResponse(BaseModel):
    message: str
    dataset_id: str
    original_rows: int
    cleaned_rows: int
    removed_duplicate_rows: int
    before_missing_cells: int
    after_missing_cells: int
    before_quality_score: float
    after_quality_score: float
    actions: list[str]
    output_filename: str
