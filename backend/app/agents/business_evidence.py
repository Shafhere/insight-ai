"""Calculated evidence shared by the workspace, analyst and frozen reports."""

import json
from copy import deepcopy
from functools import lru_cache
from uuid import UUID

from app.analytics.customer_growth import customer_growth, fields, field
from app.analytics.engagement import feedback_summary, tracking
from app.analytics.service import load_analytics_dataset
from app.cleaning import get_original_file
from app.config import settings
from app.forecasting.service import forecast_series, ForecastingError


def folder_for(dataset_id):
    return settings.storage_dir / str(UUID(str(dataset_id)))


def outlook(frame, horizon=3, metric=None):
    mapping = fields(frame)
    choices = list(
        dict.fromkeys(
            col
            for col in (
                mapping["value"],
                field(frame, "units_sold", "quantity", "quantity_sold", "qty", "units"),
            )
            if col
        )
    )
    if not mapping["date"] or not choices:
        return {
            "reason": "A transaction date and a revenue or units measure are required.",
            "metrics": choices,
        }
    value = metric or choices[0]
    if value not in choices:
        return {"reason": "Choose a revenue or sold-quantity measure.", "metrics": choices}
    try:
        result = forecast_series(frame, mapping["date"], value, horizon=horizon, allow_returns=True)
    except ForecastingError as error:
        result = {"reason": str(error)}
    return {**result, "metrics": choices, "value_column": value}


def workspace_outlook(dataset_id, horizon=None, metric=None):
    path = folder_for(dataset_id) / "forecast_settings.json"
    saved = json.loads(path.read_text()) if path.exists() else {}
    return outlook(
        load_analytics_dataset(dataset_id),
        horizon if horizon is not None else saved.get("horizon", 3),
        metric if metric is not None else saved.get("metric"),
    )


@lru_cache(maxsize=4)
def _purchase_summary(source_id, active_path, modified):
    # The path and timestamp invalidate cached calculations after approved cleaning.
    return customer_growth(load_analytics_dataset(source_id), private=True)


def workspace_growth(dataset_id, private=False):
    folder = folder_for(dataset_id)
    pointer = folder / "customer_source.txt"
    source_id = pointer.read_text().strip() if pointer.exists() else dataset_id
    path = get_original_file(source_id)
    cleaned = path.parent / "cleaned.csv"
    active = cleaned if cleaned.is_file() else path
    result = deepcopy(_purchase_summary(source_id, str(active), active.stat().st_mtime_ns))
    result["engagement"] = tracking(dataset_id, result.get("rows", []))
    if not private:
        result.pop("rows", None)
    feedback = folder / "feedback.txt"
    if feedback.exists():
        result["feedback"] = feedback_summary(load_analytics_dataset(feedback.read_text()))
    result["source_dataset"] = source_id
    return result
