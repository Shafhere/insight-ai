
from typing import Any

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype


def safe_value(value: Any) -> float | int | None:
    """Convert a numeric value into a JSON-safe Python value."""
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None

        number = float(value)

        if not np.isfinite(number):
            return None

        return int(number) if number.is_integer() else round(number, 2)

    except (TypeError, ValueError, OverflowError):
        return None


def generate_findings(
    dataframe: pd.DataFrame,
    semantic_types: dict[str, str],
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    if dataframe.empty:
        return [{
            "type": "warning",
            "title": "Empty dataset",
            "description": "No records are available for analysis.",
            "evidence": {},
        }]

    # Data quality checks
    missing = int(dataframe.isna().sum().sum())
    duplicates = int(dataframe.duplicated().sum())

    if missing:
        findings.append({
            "type": "risk",
            "title": "Missing data detected",
            "description": "Some records contain missing values.",
            "evidence": {"missing_cells": missing},
        })

    if duplicates:
        findings.append({
            "type": "risk",
            "title": "Duplicate records detected",
            "description": (
                "Duplicate rows may affect business calculations."
            ),
            "evidence": {"duplicate_rows": duplicates},
        })

    # Identify semantic business columns
    revenue_columns = [
        column
        for column, semantic in semantic_types.items()
        if (
            semantic == "revenue"
            and column in dataframe.columns
            and is_numeric_dtype(dataframe[column])
        )
    ]

    product_columns = [
        column
        for column, semantic in semantic_types.items()
        if semantic == "product" and column in dataframe.columns
    ]

    category_columns = [
        column
        for column, semantic in semantic_types.items()
        if semantic == "category" and column in dataframe.columns
    ]

    # Revenue and product performance
    if revenue_columns:
        revenue_column = revenue_columns[0]

        revenue = pd.to_numeric(
            dataframe[revenue_column],
            errors="coerce",
        ).replace([np.inf, -np.inf], np.nan).dropna()

        if not revenue.empty:
            findings.append({
                "type": "kpi",
                "title": "Total recorded revenue",
                "description": (
                    "Total revenue calculated from the selected dataset."
                ),
                "evidence": {
                    "column": revenue_column,
                    "total": safe_value(revenue.sum()),
                    "average": safe_value(revenue.mean()),
                    "minimum": safe_value(revenue.min()),
                    "maximum": safe_value(revenue.max()),
                },
            })

            negative_count = int((revenue < 0).sum())

            if negative_count:
                findings.append({
                    "type": "risk",
                    "title": "Negative revenue values",
                    "description": (
                        "Negative values require review. They may represent "
                        "refunds, corrections, or data errors."
                    ),
                    "evidence": {
                        "negative_records": negative_count,
                    },
                })

            # Product-level revenue
            if product_columns:
                product_column = product_columns[0]

                working = dataframe[
                    [product_column, revenue_column]
                ].copy()

                working[revenue_column] = pd.to_numeric(
                    working[revenue_column],
                    errors="coerce",
                )

                working[revenue_column] = working[
                    revenue_column
                ].replace([np.inf, -np.inf], np.nan)

                working = working.dropna(
                    subset=[product_column, revenue_column]
                )

                grouped = (
                    working.groupby(product_column)[revenue_column]
                    .sum()
                    .sort_values(ascending=False)
                )

                if not grouped.empty:
                    findings.append({
                        "type": "opportunity",
                        "title": "Highest revenue product",
                        "description": (
                            "This product has the highest total "
                            "recorded revenue."
                        ),
                        "evidence": {
                            "product": str(grouped.index[0]),
                            "revenue": safe_value(grouped.iloc[0]),
                        },
                    })

                    findings.append({
                        "type": "insight",
                        "title": "Lowest revenue product",
                        "description": (
                            "This product has the lowest total recorded "
                            "revenue among products in the dataset."
                        ),
                        "evidence": {
                            "product": str(grouped.index[-1]),
                            "revenue": safe_value(grouped.iloc[-1]),
                        },
                    })

            # Category-level revenue
            if category_columns:
                category_column = category_columns[0]

                working = dataframe[
                    [category_column, revenue_column]
                ].copy()

                working[revenue_column] = pd.to_numeric(
                    working[revenue_column],
                    errors="coerce",
                )

                working[revenue_column] = working[
                    revenue_column
                ].replace([np.inf, -np.inf], np.nan)

                working = working.dropna(
                    subset=[category_column, revenue_column]
                )

                grouped = (
                    working.groupby(category_column)[revenue_column]
                    .sum()
                    .sort_values(ascending=False)
                )

                if not grouped.empty:
                    findings.append({
                        "type": "insight",
                        "title": "Top revenue category",
                        "description": (
                            "This category contributes the most "
                            "recorded revenue."
                        ),
                        "evidence": {
                            "category": str(grouped.index[0]),
                            "revenue": safe_value(grouped.iloc[0]),
                        },
                    })

    # Numeric anomalies: descriptive warning, not automatic diagnosis
    for column in dataframe.select_dtypes(include="number").columns:
        series = pd.to_numeric(
            dataframe[column],
            errors="coerce",
        ).replace([np.inf, -np.inf], np.nan).dropna()

        if len(series) < 5:
            continue

        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1

        if iqr <= 0:
            continue

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outliers = (
            (series < lower_bound)
            | (series > upper_bound)
        )

        outlier_count = int(outliers.sum())

        if outlier_count:
            findings.append({
                "type": "warning",
                "title": f"Potential outliers in {column}",
                "description": (
                    "Values outside the 1.5 IQR range were detected. "
                    "Review them before making decisions."
                ),
                "evidence": {
                    "column": column,
                    "outlier_count": outlier_count,
                },
            })

    if not findings:
        findings.append({
            "type": "info",
            "title": "No significant findings",
            "description": (
                "The automated checks did not identify notable patterns."
            ),
            "evidence": {},
        })

    return findings
