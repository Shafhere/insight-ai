from typing import Any

import numpy as np
import pandas as pd

from app.modules.understanding.domain_detector import detect_domain
from app.modules.understanding.schema import (
    infer_data_type,
    infer_semantic_type,
)
from app.schemas.dataset import ColumnProfile, DatasetProfile


def make_json_safe(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, dict):
        return {
            str(key): make_json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [make_json_safe(item) for item in value]

    if isinstance(value, np.generic):
        value = value.item()

    if pd.isna(value):
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    return str(value)


def profile_dataset(
    dataframe: pd.DataFrame,
    dataset_id: str,
    filename: str,
    file_type: str,
) -> DatasetProfile:

    rows, columns = dataframe.shape

    duplicate_rows = int(dataframe.duplicated().sum())

    missing_cells = int(dataframe.isna().sum().sum())

    total_cells = rows * columns

    missing_percentage = (
        (missing_cells / total_cells) * 100
        if total_cells
        else 0.0
    )

    duplicate_percentage = (
        (duplicate_rows / rows) * 100
        if rows
        else 0.0
    )

    missing_penalty = min(missing_percentage * 0.4, 40)

    duplicate_penalty = min(duplicate_percentage * 0.3, 30)

    constant_columns = sum(
        dataframe[column].nunique(dropna=True) <= 1
        for column in dataframe.columns
    )

    constant_penalty = (
        (constant_columns / columns) * 10
        if columns
        else 0
    )

    quality_score = round(
        max(
            0,
            100 - missing_penalty - duplicate_penalty - constant_penalty,
        ),
        2,
    )

    column_profiles = []

    for column in dataframe.columns:
        series = dataframe[column]

        missing_count = int(series.isna().sum())

        missing_column_percentage = (
            (missing_count / rows) * 100
            if rows
            else 0
        )

        data_type = infer_data_type(series)

        semantic_type = infer_semantic_type(
            column,
            series,
        )

        statistics = {}

        if data_type == "numeric":
            numeric_series = pd.to_numeric(
                series,
                errors="coerce",
            )

            description = numeric_series.describe()

            statistics = make_json_safe(
                description.to_dict()
            )

        else:
            top_values = (
                series.dropna()
                .astype(str)
                .value_counts()
                .head(5)
                .to_dict()
            )

            statistics = {
                "top_values": make_json_safe(top_values)
            }

        sample_values = [
            make_json_safe(value)
            for value in series.dropna().head(5).tolist()
        ]

        column_profiles.append(
            ColumnProfile(
                name=str(column),
                data_type=data_type,
                semantic_type=semantic_type,
                missing_count=missing_count,
                missing_percentage=round(
                    missing_column_percentage,
                    2,
                ),
                unique_count=int(series.nunique(dropna=True)),
                sample_values=sample_values,
                statistics=statistics,
            )
        )

    domain, confidence = detect_domain(
        dataframe.columns.tolist()
    )

    warnings = []

    if missing_cells:
        warnings.append(
            f"Dataset contains {missing_cells} missing cells."
        )

    if duplicate_rows:
        warnings.append(
            f"Dataset contains {duplicate_rows} duplicate rows."
        )

    if constant_columns:
        warnings.append(
            f"{constant_columns} column(s) contain one or zero unique values."
        )

    return DatasetProfile(
        dataset_id=dataset_id,
        filename=filename,
        file_type=file_type,
        rows=rows,
        columns=columns,
        duplicate_rows=duplicate_rows,
        missing_cells=missing_cells,
        missing_percentage=round(missing_percentage, 2),
        quality_score=quality_score,
        detected_domain=domain,
        domain_confidence=confidence,
        column_profiles=column_profiles,
        warnings=warnings,
    )