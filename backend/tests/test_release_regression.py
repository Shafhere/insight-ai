"""Regression coverage for the November 2026 business-dashboard release."""

import numpy as np
import pandas as pd
import pytest

from app.prediction.forecasting import ForecastingError, forecast_segments, forecast_series
from app.api.portal import answer_from_published_snapshot


def test_small_returns_are_netted_in_business_forecast():
    dates = pd.date_range("2024-01-01", periods=18, freq="MS")
    observations = pd.DataFrame({"date": dates, "revenue": [f"₹{1000 + 50 * i:,}" for i in range(18)]})
    observations.loc[0, "revenue"] = "₹-30"  # Recorded correction in an otherwise positive data set
    observations = pd.concat([observations, pd.DataFrame({"date": [dates[0]], "revenue": ["₹1,200"]})], ignore_index=True)
    expected = forecast_series(observations, "date", "revenue", allow_returns=True)
    assert len(expected["forecasts"]) == 3
    assert expected["negative_transactions_netted"] == 1
    assert any("netted" in line for line in expected["limitations"])
    with pytest.raises(ForecastingError, match="Negative demand"):
        forecast_series(observations, "date", "revenue")


def test_negative_net_period_is_rejected_even_with_returns_enabled():
    frame = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=18, freq="MS"), "quantity": [100.0] * 18})
    frame.loc[5, "quantity"] = -1000
    with pytest.raises(ForecastingError, match="Net demand"):
        forecast_series(frame, "date", "quantity", allow_returns=True)


def test_product_demand_forecast_is_per_segment():
    dates = pd.date_range("2024-01-01", periods=20, freq="MS")
    data = pd.DataFrame({"date": list(dates) * 2, "units": list(range(20, 40)) + list(range(40, 60)), "product": ["Bag"] * 20 + ["Shoe"] * 20})
    result = forecast_segments(data, "date", "units", "product")
    assert len(result["segments"]) == 2
    assert all(len(item["forecast"]["forecasts"]) == 3 for item in result["segments"])
    assert result["segments"][0]["group"] == "Shoe"


def test_viewer_answers_distinct_questions_from_published_evidence():
    snapshot = {
        "overview": {"metrics": [{"name": "Total Revenue", "value": 12300}]},
        "decision": {"executive_summary": "Test commerce summary.", "recommendations": ["Review returns weekly"], "risks": ["Stockouts"]},
        "trend": [{"period": "2026-08", "value": 90}, {"period": "2026-09", "value": 100}],
        "charts": {"category": [{"name": "Shoes", "value": 6000}, {"name": "Bags", "value": 3000}]},
        "forecast": {"value_column": "revenue", "selected_method": "linear_trend", "forecasts": [{"period": "2026-10-01", "forecast": 110}, {"period": "2026-11-01", "forecast": 120}]},
    }
    future = answer_from_published_snapshot("Forecast next month sales", snapshot)
    ranking = answer_from_published_snapshot("Highest category?", snapshot)
    comparison = answer_from_published_snapshot("Compare last month and previous month", snapshot)
    actions = answer_from_published_snapshot("What actions do you recommend?", snapshot)
    assert "110" in future["answer"]
    assert "Shoes" in ranking["answer"]
    assert "2026-09" in comparison["answer"]
    assert "Review returns" in actions["answer"]
    assert len({future["answer"], ranking["answer"], comparison["answer"], actions["answer"]}) == 4
    assert "chart" in future and "chart" in ranking and "chart" in comparison
