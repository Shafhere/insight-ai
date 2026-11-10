from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    source: str = "original"
    date_column: str = Field(min_length=1)
    value_column: str = Field(min_length=1)
    horizon: int = Field(default=3, ge=1, le=24)
    frequency: str = "MS"
    current_stock: float | None = Field(default=None, ge=0)
    lead_time_periods: int = Field(default=1, ge=1, le=24)
