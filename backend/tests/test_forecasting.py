import numpy as np
import pandas as pd
import pytest

from app.prediction.forecasting import ForecastingError, forecast_series


def sample_data():
    dates = pd.date_range("2023-01-01", periods=24, freq="MS")
    return pd.DataFrame({"date": dates, "units": np.arange(100, 124) * 1.0})


def test_forecast_returns_backtest_and_horizon():
    result = forecast_series(sample_data(), "date", "units", horizon=4)
    assert len(result["forecasts"]) == 4
    assert result["selected_method"] in {"linear_trend", "last_observation_baseline"}
    assert result["backtest_metrics"]["linear_trend"]["mae"] >= 0


def test_inventory_recommendation_is_optional_and_explained():
    result = forecast_series(sample_data(), "date", "units", horizon=3, current_stock=10, lead_time_periods=2)
    assert result["inventory_recommendation"]["suggested_reorder_quantity"] > 0
    assert "Confirm lead time" in result["inventory_recommendation"]["explanation"]


def test_requires_minimum_history():
    data = sample_data().head(6)
    with pytest.raises(ForecastingError, match="At least 10"):
        forecast_series(data, "date", "units")


def test_rejects_negative_demand():
    data = sample_data(); data.loc[0, "units"] = -1
    with pytest.raises(ForecastingError, match="Negative demand"):
        forecast_series(data, "date", "units")


def test_forecast_parses_currency_formatted_numeric_values():
    data = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=18, freq="MS"),
        "revenue": [f"${1_000 + index * 25:,.2f}" for index in range(18)],
    })
    result = forecast_series(data, "date", "revenue", horizon=3)
    assert len(result["forecasts"]) == 3
    assert result["forecasts"][0]["forecast"] > 0
