from typing import Any

from pydantic import BaseModel, Field


class PredictiveReport(BaseModel):
    dataset_id: str
    task: str
    target_column: str
    model_name: str
    training_rows: int
    testing_rows: int
    features_used: list[str]
    removed_constant_columns: list[str] = Field(default_factory=list)
    metrics: dict[str, float]
    feature_importance: list[dict[str, Any]]
    cv_folds: int
    cv_metric: str
    model_comparison: list[dict[str, Any]]


class PredictionRequest(BaseModel):
    records: list[dict[str, Any]] = Field(min_length=1)


class PredictionResponse(BaseModel):
    dataset_id: str
    prediction_count: int
    predictions: list[Any]