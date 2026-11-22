
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DataQueryRequest(BaseModel):
    operation: Literal[
        "overview",
        "aggregate",
        "distinct",
        "group_by",
    ]

    column: str | None = None
    aggregation: Literal[
        "sum",
        "mean",
        "min",
        "max",
        "count",
        "median",
    ] = "count"

    group_by: str | None = None
    metric: str | None = None

    limit: int = Field(default=100, ge=1, le=500)

    @model_validator(mode="after")
    def validate_required_fields(self):
        if self.operation in {"aggregate", "distinct"} and not self.column:
            raise ValueError(
                f"'column' is required for {self.operation}."
            )

        if self.operation == "group_by" and not self.group_by:
            raise ValueError(
                "'group_by' is required for group_by operation."
            )

        return self
