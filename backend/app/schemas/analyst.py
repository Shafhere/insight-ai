
from typing import Literal

from pydantic import BaseModel, Field, model_validator

AggregationType = Literal[
    "sum",
    "mean",
    "min",
    "max",
    "count",
    "median",
]

OperationType = Literal[
    "overview",
    "aggregate",
    "distinct",
    "group_by",
    "none",
]


class AnalystQuestionRequest(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=2000,
        description="Natural-language question about the uploaded dataset.",
    )


class AnalystPlan(BaseModel):
    """Validated tool-selection plan returned by the AI planner."""

    needs_analytics: bool
    needs_rag: bool

    operation: OperationType = "none"

    column: str | None = None
    aggregation: AggregationType | None = None

    group_by: str | None = None
    metric: str | None = None

    limit: int = Field(default=100, ge=1, le=500)
    reason: str = Field(default="", max_length=500)

    @model_validator(mode="before")
    @classmethod
    def set_default_limit(cls, values):
        """Normalize a missing or null limit before validation."""

        if isinstance(values, dict):
            values = values.copy()

            if values.get("limit") is None:
                values["limit"] = 100

        return values

    @model_validator(mode="after")
    def validate_plan(self):
        """Ensure the selected tools and parameters are consistent."""

        if self.needs_analytics and self.operation == "none":
            raise ValueError(
                "An analytics operation is required when analytics is enabled."
            )

        if not self.needs_analytics and self.operation != "none":
            raise ValueError(
                "An operation cannot be selected when analytics is disabled."
            )

        if self.operation in {"aggregate", "distinct"}:
            if not self.column:
                raise ValueError(
                    f"A column is required for {self.operation}."
                )

        if self.operation == "aggregate":
            if not self.aggregation:
                raise ValueError(
                    "An aggregation method is required for aggregate."
                )

        if self.operation == "group_by":
            if not self.group_by:
                raise ValueError(
                    "A grouping column is required for group_by."
                )

            if not self.aggregation:
                raise ValueError(
                    "An aggregation method is required for group_by."
                )

            if self.aggregation != "count" and not self.metric:
                raise ValueError(
                    "A metric column is required unless aggregation is count."
                )

        if self.operation == "none" and self.needs_rag is False:
            return self

        return self
