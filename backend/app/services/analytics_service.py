
from typing import Any

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype

from app.modules.understanding.loader import load_dataset
from app.schemas.analytics import (
    AnalyticsOverview,
    BreakdownResponse,
    CorrelationResponse,
    Metric,
    TrendResponse,
)
from app.services.cleaning_service import get_original_file
from app.services.dataset_service import get_dataset_profile


def _numeric_series(series: pd.Series) -> pd.Series:
    """Parse common currency/number strings without mutating source data."""
    if is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    cleaned = series.astype("string").str.strip().str.replace(
        r"[$€£₹,\s%]", "", regex=True
    )
    cleaned = cleaned.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
    return pd.to_numeric(cleaned, errors="coerce")


def prepare_business_dataframe(dataframe: pd.DataFrame, semantic_types: dict[str, str] | None = None) -> pd.DataFrame:
    """Create an analysis-only copy with parseable price/quantity and derived revenue."""
    semantic_types = semantic_types or {}
    working = dataframe.copy()
    for column in working.columns:
        semantic = semantic_types.get(column, "")
        name = column.lower()
        if semantic in {"price", "quantity", "revenue", "numeric"} or any(
            token in name for token in ("price", "amount", "sales", "revenue", "quantity", "qty", "units", "cost")
        ):
            parsed = _numeric_series(working[column])
            if parsed.notna().sum() >= max(1, int(working[column].notna().sum() * 0.5)):
                working[column] = parsed

    revenue_candidates = [
        column for column in working.columns
        if semantic_types.get(column) == "revenue" or any(token in column.lower() for token in ("revenue", "sales_amount", "total_sales", "sales_value"))
    ]
    if not revenue_candidates:
        price = next((c for c in working.columns if semantic_types.get(c) == "price" or "price" in c.lower()), None)
        quantity = next((c for c in working.columns if semantic_types.get(c) == "quantity" or any(t in c.lower() for t in ("quantity", "qty", "units_sold"))), None)
        if price and quantity and is_numeric_dtype(working[price]) and is_numeric_dtype(working[quantity]):
            working["__insight_revenue__"] = working[price] * working[quantity]
    return working


class AnalyticsServiceError(Exception):
    """Raised when an analytics operation cannot be completed."""


def load_analytics_dataset(
    dataset_id: str,
    source: str = "original",
) -> pd.DataFrame:
    original_path = get_original_file(dataset_id)

    if source == "original":
        file_path = original_path
    elif source == "cleaned":
        file_path = original_path.parent / "cleaned.csv"

        if not file_path.is_file():
            raise FileNotFoundError(
                "Cleaned dataset not found. Apply cleaning first."
            )
    else:
        raise AnalyticsServiceError(
            "Source must be 'original' or 'cleaned'."
        )

    return load_dataset(file_path)


def get_semantic_columns(dataset_id: str) -> dict[str, str]:
    profile = get_dataset_profile(dataset_id)

    return {
        column.name: column.semantic_type
        for column in profile.column_profiles
    }


def safe_number(value: Any) -> float | int | None:
    if value is None or pd.isna(value):
        return None

    number = float(value)

    if not np.isfinite(number):
        return None

    if number.is_integer():
        return int(number)

    return round(number, 4)


def calculate_overview(
    dataset_id: str,
    source: str = "original",
) -> AnalyticsOverview:
    raw_dataframe = load_analytics_dataset(dataset_id, source)
    semantic_types = get_semantic_columns(dataset_id)
    dataframe = prepare_business_dataframe(raw_dataframe, semantic_types)

    numeric_columns = [
        column for column in dataframe.columns
        if is_numeric_dtype(dataframe[column])
        and semantic_types.get(column) != "identifier"
        and not column.lower().endswith(("_id", "id", "_code"))
    ]

    categorical_columns = [
        column
        for column in dataframe.columns
        if (
            not is_numeric_dtype(dataframe[column])
            and semantic_types.get(column) not in {"identifier", "date"}
            and dataframe[column].nunique(dropna=True) <= 50
        )
    ]

    date_columns = [
        column
        for column in dataframe.columns
        if semantic_types.get(column) == "date"
    ]

    metrics = []
    insights = []

    metrics.append(
        Metric(
            name="Total Rows",
            value=len(dataframe),
            description="Number of records in the dataset.",
        )
    )

    metrics.append(
        Metric(
            name="Total Columns",
            value=len(raw_dataframe.columns),
            description="Number of fields in the uploaded dataset. Derived analysis fields are not counted.",
        )
    )

    metrics.append(
        Metric(
            name="Missing Cells",
            value=int(dataframe.isna().sum().sum()),
            description="Total number of missing values.",
        )
    )

    metrics.append(
        Metric(
            name="Duplicate Rows",
            value=int(dataframe.duplicated().sum()),
            description="Number of fully duplicated records.",
        )
    )

    revenue_columns = [
        column
        for column, semantic in semantic_types.items()
        if semantic == "revenue" and column in numeric_columns
    ]

    quantity_columns = [
        column
        for column, semantic in semantic_types.items()
        if semantic == "quantity" and column in numeric_columns
    ]

    identifier_columns = [
        column
        for column, semantic in semantic_types.items()
        if semantic == "identifier"
    ]

    for column in revenue_columns:
        total_revenue = dataframe[column].sum()

        metrics.append(
            Metric(
                name=f"Total {column.replace('_', ' ').title()}",
                value=safe_number(total_revenue),
                description=f"Sum of all values in {column}.",
            )
        )

        if identifier_columns:
            order_column = next(
                (
                    item
                    for item in identifier_columns
                    if "order" in item.lower()
                ),
                None,
            )

            if order_column:
                order_count = int(
                    dataframe[order_column].nunique(dropna=True)
                )

                average_order_value = (
                    total_revenue / order_count if order_count else 0
                )

                metrics.append(
                    Metric(
                        name="Average Order Value",
                        value=safe_number(average_order_value),
                        description=(
                            "Total revenue divided by unique order IDs."
                        ),
                    )
                )

    if "__insight_revenue__" in dataframe.columns:
        total_revenue = dataframe["__insight_revenue__"].sum(min_count=1)
        metrics.append(Metric(
            name="Estimated Revenue",
            value=safe_number(total_revenue),
            description="Calculated as unit price multiplied by quantity. This is a derived metric, not a source column.",
        ))
        insights.append("Revenue was derived from the available price and quantity columns for business analysis.")

    for column in quantity_columns:
        metrics.append(
            Metric(
                name=f"Total {column.replace('_', ' ').title()}",
                value=safe_number(dataframe[column].sum()),
                description=f"Sum of all values in {column}.",
            )
        )

    numeric_summary = []

    for column in numeric_columns:
        series = dataframe[column]

        numeric_summary.append(
            {
                "column": column,
                "count": int(series.count()),
                "sum": safe_number(series.sum()),
                "mean": safe_number(series.mean()),
                "minimum": safe_number(series.min()),
                "maximum": safe_number(series.max()),
                "median": safe_number(series.median()),
            }
        )

    if dataframe.empty:
        insights.append("The dataset contains no records.")

    if dataframe.isna().sum().sum() > 0:
        insights.append(
            "Missing values exist. Consider reviewing data preparation."
        )

    if dataframe.duplicated().sum() > 0:
        insights.append(
            "Duplicate records exist in the selected dataset."
        )

    if revenue_columns:
        revenue_column = revenue_columns[0]

        if not dataframe.empty:
            best_value = dataframe[revenue_column].max()

            if pd.notna(best_value):
                best_row = dataframe.loc[
                    dataframe[revenue_column].idxmax()
                ]

                product_column = next(
                    (
                        column
                        for column, semantic in semantic_types.items()
                        if semantic == "product"
                        and column in dataframe.columns
                    ),
                    None,
                )

                if product_column:
                    insights.append(
                        f"Highest individual {revenue_column} record "
                        f"belongs to {best_row[product_column]}."
                    )



    return AnalyticsOverview(
        dataset_id=dataset_id,
        source=source,
        rows=len(dataframe),
        columns=len(raw_dataframe.columns),
        missing_cells=int(raw_dataframe.isna().sum().sum()),
        duplicate_rows=int(raw_dataframe.duplicated().sum()),
        metrics=metrics,
        numeric_summary=numeric_summary,
        categorical_columns=categorical_columns,
        date_columns=date_columns,
        insights=insights,
    )


def calculate_breakdown(
    dataset_id: str,
    group_by: str,
    metric: str | None = None,
    aggregation: str = "sum",
    source: str = "original",
) -> BreakdownResponse:
    semantic_types = get_semantic_columns(dataset_id)
    dataframe = prepare_business_dataframe(load_analytics_dataset(dataset_id, source), semantic_types)

    if group_by not in dataframe.columns:
        raise AnalyticsServiceError(
            f"Column '{group_by}' does not exist."
        )

    if metric and metric not in dataframe.columns:
        raise AnalyticsServiceError(
            f"Metric column '{metric}' does not exist."
        )

    if metric and metric not in dataframe.columns:
        raise AnalyticsServiceError(f"Metric '{metric}' does not exist.")
    if metric and not is_numeric_dtype(dataframe[metric]):
        raise AnalyticsServiceError(
            f"Metric '{metric}' must be numeric."
        )

    if aggregation not in {"sum", "mean", "count", "min", "max"}:
        raise AnalyticsServiceError("Unsupported aggregation.")

    if aggregation == "count":
        grouped = dataframe.groupby(
            group_by,
            dropna=False,
        ).size().reset_index(name="value")
    else:
        if metric is None:
            raise AnalyticsServiceError(
                "A numeric metric is required for this aggregation."
            )

        grouped = (
            dataframe.groupby(group_by, dropna=False)[metric]
            .agg(aggregation)
            .reset_index(name="value")
        )

    grouped = grouped.sort_values(
        "value",
        ascending=False,
    )

    results = []

    for _, row in grouped.head(100).iterrows():
        group_value = row[group_by]

        results.append(
            {
                "group": (
                    str(group_value)
                    if pd.notna(group_value)
                    else "Missing"
                ),
                "value": safe_number(row["value"]),
            }
        )

    return BreakdownResponse(
        dataset_id=dataset_id,
        group_by=group_by,
        metric=metric,
        aggregation=aggregation,
        results=results,
    )


def calculate_trend(
    dataset_id: str,
    date_column: str,
    metric: str,
    frequency: str = "month",
    source: str = "original",
) -> TrendResponse:
    semantic_types = get_semantic_columns(dataset_id)
    dataframe = prepare_business_dataframe(load_analytics_dataset(dataset_id, source), semantic_types)

    if date_column not in dataframe.columns:
        raise AnalyticsServiceError(
            f"Date column '{date_column}' does not exist."
        )

    if metric not in dataframe.columns:
        raise AnalyticsServiceError(
            f"Metric column '{metric}' does not exist."
        )

    if not is_numeric_dtype(dataframe[metric]):
        raise AnalyticsServiceError(
            f"Metric '{metric}' must be numeric."
        )

    frequency_map = {
        "day": "D",
        "week": "W",
        "month": "ME",
        "year": "YE",
    }

    if frequency not in frequency_map:
        raise AnalyticsServiceError(
            "Frequency must be day, week, month or year."
        )

    working = dataframe[[date_column, metric]].copy()

    working[date_column] = pd.to_datetime(
        working[date_column],
        errors="coerce",
    )

    working = working.dropna(subset=[date_column])

    if working.empty:
        raise AnalyticsServiceError(
            "No valid dates were found in this column."
        )

    grouped = (
        working.set_index(date_column)[metric]
        .resample(frequency_map[frequency])
        .sum()
        .reset_index()
    )

    results = [
        {
            "period": row[date_column].strftime("%Y-%m-%d"),
            "value": safe_number(row[metric]),
        }
        for _, row in grouped.iterrows()
    ]

    return TrendResponse(
        dataset_id=dataset_id,
        date_column=date_column,
        metric=metric,
        frequency=frequency,
        results=results,
    )


def calculate_correlations(
    dataset_id: str,
    source: str = "original",
) -> CorrelationResponse:
    semantic_types = get_semantic_columns(dataset_id)
    dataframe = prepare_business_dataframe(load_analytics_dataset(dataset_id, source), semantic_types)

    numeric = dataframe.select_dtypes(include="number").drop(
        columns=[c for c in dataframe.columns if semantic_types.get(c) == "identifier" or c.lower().endswith(("_id", "id", "_code"))],
        errors="ignore",
    )

    if len(numeric.columns) < 2:
        raise AnalyticsServiceError(
            "At least two numeric columns are required."
        )

    correlation = numeric.corr(method="pearson")

    strong_relationships = []

    for first in correlation.columns:
        for second in correlation.columns:
            if first >= second:
                continue

            value = correlation.loc[first, second]

            if pd.notna(value) and abs(value) >= 0.7:
                strong_relationships.append(
                    {
                        "column_1": first,
                        "column_2": second,
                        "correlation": round(float(value), 4),
                        "strength": (
                            "strong positive"
                            if value > 0
                            else "strong negative"
                        ),
                    }
                )

    matrix = [
        [
            safe_number(value)
            for value in row
        ]
        for row in correlation.to_numpy()
    ]

    return CorrelationResponse(
        dataset_id=dataset_id,
        columns=list(correlation.columns),
        matrix=matrix,
        strong_relationships=strong_relationships,
    )
