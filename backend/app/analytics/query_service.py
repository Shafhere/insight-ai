
"""
INSIGHT AI - Full Dataset Query Engine

Executes deterministic operations on the complete uploaded dataset.
The original uploaded file is always preserved.
"""

from pathlib import Path
from typing import Any

import pandas as pd

from app.config import settings
from app.data.ingestion import load_dataset
from app.data.dataset_service import get_dataset_profile

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xlsm", ".json", ".jsonl", ".ndjson"}
SUPPORTED_AGGREGATIONS = {"sum", "mean", "min", "max", "count", "median"}


def get_original_dataset_path(dataset_id: str) -> Path:
    """Locate the original uploaded file using its dataset ID."""

    # Validate the dataset and confirm its metadata exists.
    get_dataset_profile(dataset_id)

    dataset_directory = settings.storage_dir / dataset_id

    for extension in SUPPORTED_EXTENSIONS:
        file_path = dataset_directory / f"original{extension}"

        if file_path.is_file():
            return file_path

    raise FileNotFoundError("Original dataset file was not found.")


def load_full_dataset(dataset_id: str) -> pd.DataFrame:
    """Load every row from the original uploaded dataset."""

    # Use the same active dataset as dashboards, forecasts and decisions.
    from app.analytics.service import load_analytics_dataset
    return load_analytics_dataset(dataset_id, "auto")


def _validate_column(dataframe: pd.DataFrame, column: str) -> None:
    if column not in dataframe.columns:
        raise ValueError(
            f"Column '{column}' does not exist. "
            f"Available columns: {list(dataframe.columns)}"
        )


def _clean_value(value: Any) -> Any:
    """Convert Pandas and NumPy values into JSON-compatible values."""

    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        value = value.item()

    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()

    return value


def _records_to_json(records: list[dict]) -> list[dict]:
    return [
        {key: _clean_value(value) for key, value in record.items()}
        for record in records
    ]


def get_dataset_overview(dataset_id: str) -> dict:
    """Return statistics calculated from all rows."""

    dataframe = load_full_dataset(dataset_id)

    numeric_columns = dataframe.select_dtypes(
        include="number"
    ).columns.tolist()

    return {
        "dataset_id": dataset_id,
        "total_rows": len(dataframe),
        "total_columns": len(dataframe.columns),
        "columns": dataframe.columns.tolist(),
        "numeric_columns": numeric_columns,
        "missing_cells": int(dataframe.isna().sum().sum()),
        "duplicate_rows": int(dataframe.duplicated().sum()),
        "column_missing_values": {
            column: int(count)
            for column, count in dataframe.isna().sum().items()
        },
    }


def aggregate_column(
    dataset_id: str,
    column: str,
    aggregation: str,
) -> dict:
    """Calculate a statistic from every non-null value in a column."""

    dataframe = load_full_dataset(dataset_id)
    _validate_column(dataframe, column)

    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(
            f"Unsupported aggregation. Choose from: "
            f"{sorted(SUPPORTED_AGGREGATIONS)}"
        )

    series = dataframe[column]

    if aggregation != "count":
        series = pd.to_numeric(series, errors="coerce")

        if series.notna().sum() == 0:
            raise ValueError(
                f"Column '{column}' contains no usable numeric values."
            )

    result = getattr(series, aggregation)()

    return {
        "dataset_id": dataset_id,
        "column": column,
        "aggregation": aggregation,
        "result": _clean_value(result),
        "rows_in_dataset": len(dataframe),
        "non_null_values": int(dataframe[column].notna().sum()),
    }


def get_distinct_values(
    dataset_id: str,
    column: str,
    limit: int = 100,
) -> dict:
    """Return distinct values from the complete column."""

    dataframe = load_full_dataset(dataset_id)
    _validate_column(dataframe, column)

    values = dataframe[column].dropna().drop_duplicates().tolist()

    return {
        "dataset_id": dataset_id,
        "column": column,
        "total_unique_values": len(values),
        "returned_values": min(len(values), limit),
        "values": [_clean_value(value) for value in values[:limit]],
        "truncated": len(values) > limit,
    }


def group_by_column(
    dataset_id: str,
    group_by: str,
    aggregation: str = "count",
    metric: str | None = None,
    limit: int = 20,
) -> dict:
    """Group all rows and calculate an aggregation."""

    dataframe = load_full_dataset(dataset_id)

    _validate_column(dataframe, group_by)

    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(
            f"Unsupported aggregation. Choose from: "
            f"{sorted(SUPPORTED_AGGREGATIONS)}"
        )

    if aggregation == "count" and metric is None:
        grouped = (
            dataframe.groupby(group_by, dropna=False)
            .size()
            .reset_index(name="result")
        )
    else:
        if metric is None:
            raise ValueError(
                "A metric column is required for this aggregation."
            )

        _validate_column(dataframe, metric)

        if aggregation != "count":
            dataframe[metric] = pd.to_numeric(
                dataframe[metric], errors="coerce"
            )

            if dataframe[metric].notna().sum() == 0:
                raise ValueError(
                    f"Column '{metric}' has no usable numeric values."
                )

        grouped = (
            dataframe.groupby(group_by, dropna=False)[metric]
            .agg(aggregation)
            .reset_index(name="result")
        )

    grouped = grouped.sort_values(
        by="result",
        ascending=False,
        na_position="last",
    ).head(limit)

    return {
        "dataset_id": dataset_id,
        "group_by": group_by,
        "metric": metric,
        "aggregation": aggregation,
        "groups_returned": len(grouped),
        "results": _records_to_json(grouped.to_dict(orient="records")),
    }


def get_dataset_rows(dataset_id: str, page: int = 1, page_size: int = 25, search: str | None = None) -> dict:
    """Return a searchable, paginated view of uploaded records."""
    dataframe = load_full_dataset(dataset_id)
    total_rows = len(dataframe)
    filtered = dataframe
    if search:
        needle = str(search).strip().lower()
        if needle:
            mask = dataframe.astype(str).apply(
                lambda column: column.str.lower().str.contains(needle, regex=False, na=False)
            ).any(axis=1)
            filtered = dataframe.loc[mask]
    total_filtered = len(filtered)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    start = (page - 1) * page_size
    view = filtered.iloc[start:start + page_size].copy()
    records = _records_to_json(view.to_dict(orient="records"))
    return {
        "dataset_id": dataset_id,
        "columns": dataframe.columns.tolist(),
        "rows": records,
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "total_filtered": total_filtered,
        "total_pages": max(1, (total_filtered + page_size - 1) // page_size),
        "search": search or "",
    }
