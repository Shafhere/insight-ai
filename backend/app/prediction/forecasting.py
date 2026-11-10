"""Transparent univariate demand forecasting with chronological backtesting.

This is an MVP statistical forecaster, not an automatic causal model. It compares
an expanding linear trend with a last-observation baseline on a chronological
holdout and reports the selected method and its limitations.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


class ForecastingError(ValueError):
    """Raised when a time series cannot be forecast responsibly."""


def _metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | None]:
    errors = actual - predicted
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors**2)))
    denominator = float(np.sum(np.abs(actual)))
    wape = float(np.sum(np.abs(errors)) / denominator * 100) if denominator else None
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "wape_percent": round(wape, 2) if wape is not None else None}


# Forecast historical periods: compare trend against the naive last-value baseline.
def forecast_series(
    dataframe: pd.DataFrame,
    date_column: str,
    value_column: str,
    horizon: int = 3,
    frequency: str = "MS",
    current_stock: float | None = None,
    lead_time_periods: int = 1,
    safety_stock_factor: float = 1.15,
    allow_returns: bool = False,
) -> dict[str, Any]:
    if date_column not in dataframe or value_column not in dataframe:
        raise ForecastingError("Choose existing date and numeric demand columns.")
    if not 1 <= horizon <= 24:
        raise ForecastingError("Forecast horizon must be between 1 and 24 periods.")
    if frequency not in {"D", "W", "MS", "QS"}:
        raise ForecastingError("Frequency must be D, W, MS (monthly), or QS (quarterly).")
    dates = pd.to_datetime(dataframe[date_column], errors="coerce", utc=True).dt.tz_convert(None)
    raw_values = dataframe[value_column]
    if pd.api.types.is_numeric_dtype(raw_values):
        values = pd.to_numeric(raw_values, errors="coerce")
    else:
        normalized = raw_values.astype("string").str.strip()
        normalized = normalized.str.replace(r"[$€£₹,\s%]", "", regex=True)
        normalized = normalized.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        values = pd.to_numeric(normalized, errors="coerce")
    clean = pd.DataFrame({"date": dates, "value": values}).dropna()
    clean = clean[np.isfinite(clean["value"])].sort_values("date")
    if clean.empty:
        raise ForecastingError("No valid date and numeric demand observations were found.")
    negative_transactions = int((clean["value"] < 0).sum())
    if negative_transactions and not allow_returns:
        raise ForecastingError("Negative demand values exist. Review returns/corrections before forecasting.")
    # When expressly enabled by the business UI, negative transactions are treated
    # as returns/corrections and NETTED at period level, never silently discarded.
    # Negative period-level demand is still not forecastable as physical demand.
    series = clean.set_index("date")["value"].resample(frequency).sum(min_count=1).dropna()
    if (series < 0).any() and allow_returns:
        raise ForecastingError("Net demand or revenue is negative for at least one period; review transactions before forecasting.")
    if len(series) < 10:
        raise ForecastingError(f"Only {len(series)} periods are available. At least 10 periods are required for this MVP forecast.")
    if series.nunique() < 2:
        raise ForecastingError("Demand is constant; a forecast comparison would not be informative.")

    values_arr = series.to_numpy(dtype=float)
    test_size = max(2, min(int(np.ceil(len(values_arr) * 0.2)), len(values_arr) - 6))
    # Time order matters: the earlier periods train, the latest periods test.
    train, actual = values_arr[:-test_size], values_arr[-test_size:]
    x_train = np.arange(len(train)).reshape(-1, 1)
    x_test = np.arange(len(train), len(values_arr)).reshape(-1, 1)
    trend = LinearRegression().fit(x_train, train).predict(x_test)
    naive = np.repeat(train[-1], len(actual))
    comparison = {
        "linear_trend": _metrics(actual, trend),
        "last_observation_baseline": _metrics(actual, naive),
    }
    chosen = "linear_trend" if comparison["linear_trend"]["mae"] <= comparison["last_observation_baseline"]["mae"] else "last_observation_baseline"
    if chosen == "linear_trend":
        model = LinearRegression().fit(np.arange(len(values_arr)).reshape(-1, 1), values_arr)
        future_values = model.predict(np.arange(len(values_arr), len(values_arr) + horizon).reshape(-1, 1))
    else:
        future_values = np.repeat(values_arr[-1], horizon)
    future_values = np.maximum(future_values, 0)
    future_dates = pd.date_range(start=series.index[-1], periods=horizon + 1, freq=frequency)[1:]
    forecasts = [{"period": date.isoformat(), "forecast": round(float(value), 2)} for date, value in zip(future_dates, future_values)]
    inventory = None
    if current_stock is not None:
        if current_stock < 0 or lead_time_periods < 1 or lead_time_periods > horizon:
            raise ForecastingError("Stock must be non-negative and lead time must fit within the forecast horizon.")
        expected_lead_demand = float(np.sum(future_values[:lead_time_periods]))
        target_stock = expected_lead_demand * safety_stock_factor
        inventory = {
            "current_stock": round(float(current_stock), 2),
            "expected_demand_during_lead_time": round(expected_lead_demand, 2),
            "safety_stock_factor": safety_stock_factor,
            "suggested_reorder_quantity": round(max(0.0, target_stock - current_stock), 2),
            "explanation": "Forecast-based estimate only. Confirm lead time, supplier constraints, minimum order quantity and stock accuracy before purchasing."
        }
    return {
        "date_column": date_column, "value_column": value_column,
        "frequency": frequency, "observed_periods": int(len(series)),
        "training_periods": int(len(train)), "backtest_periods": int(len(actual)),
        "selected_method": chosen, "backtest_metrics": comparison,
        "forecasts": forecasts, "inventory_recommendation": inventory,
        "negative_transactions_netted": negative_transactions if allow_returns else 0,
        "limitations": ([f"{negative_transactions} negative transactions (possible returns/corrections) were netted into historical period totals; verify the source records before purchasing stock."] if negative_transactions and allow_returns else []) + ["Univariate forecast: external drivers, promotions, holidays and stockouts are not modelled.", "Chronological holdout is a small-sample estimate, not a guarantee of future accuracy.", "Forecast is not a causal explanation; investigate business context before acting."],
    }



def forecast_segments(
    dataframe: pd.DataFrame,
    date_column: str,
    value_column: str,
    group_column: str,
    horizon: int = 3,
    limit: int = 5,
) -> dict[str, Any]:
    """Forecast the largest observed segments, never invent unsupported demand.

    Historical totals determine the ranked subset, and each segment is
    backtested on its own chronological series. We do not mistake a sales
    quantity for the actual warehouse stock on hand.
    """
    if not all(c in dataframe for c in (date_column, value_column, group_column)):
        raise ForecastingError("Forecast columns must exist in the dataset.")
    if not 1 <= horizon <= 12 or not 1 <= limit <= 10:
        raise ForecastingError("Invalid forecast horizon or segment limit.")
    if date_column == group_column or value_column == group_column:
        raise ForecastingError("Choose a separate product, category or location column.")
    values = dataframe[value_column]
    if not pd.api.types.is_numeric_dtype(values):
        values = pd.to_numeric(values.astype("string").str.strip()
            .str.replace(r"[$€£₹,\s%]", "", regex=True)
            .str.replace(r"^\((.*)\)$", r"-\1", regex=True), errors="coerce")
    else:
        values = pd.to_numeric(values, errors="coerce")
    prepared = dataframe[[date_column, group_column]].copy()
    prepared[value_column] = values
    prepared = prepared.dropna(subset=[group_column, value_column])
    prepared = prepared[prepared[group_column].astype(str).str.len() <= 120]
    ranked = prepared.groupby(group_column, dropna=True)[value_column].sum(min_count=1)
    ranked = ranked.replace([np.inf, -np.inf], np.nan).dropna().sort_values(ascending=False)
    segments = []
    exclusions = []
    for group_name in ranked.head(limit).index:
        subset = prepared[prepared[group_column] == group_name]
        try:
            result = forecast_series(subset, date_column, value_column, horizon=horizon, frequency="MS", allow_returns=True)
            segments.append({"group": str(group_name), "historical_total": round(float(ranked[group_name]), 2), "forecast": result})
        except ForecastingError as exc:
            exclusions.append({"group": str(group_name), "reason": str(exc)})
    return {"group_column": group_column, "value_column": value_column,
        "date_column": date_column, "segments": segments, "unavailable": exclusions,
        "limitations": ["Segments are ranked by historic totals; low-volume segments are not modelled here.",
                        "Forecast quantities estimate sales/demand, not inventory on hand or purchase order quantities.",
                        "Model error is estimated per segment and should be checked before action."]}
