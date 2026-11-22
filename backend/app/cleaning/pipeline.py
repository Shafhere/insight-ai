
import json
from pathlib import Path

import pandas as pd
from pandas.api.types import is_numeric_dtype

from app.config import settings
from app.data.ingestion import load_dataset
from app.data.profiling import profile_dataset
from app.schemas.cleaning import (
    CleaningApplyRequest,
    CleaningApplyResponse,
    CleaningPreviewResponse,
    CleaningRecommendation,
    OutlierProfile,
)
from app.data.dataset_service import get_dataset_profile
from app.schemas.dataset import DatasetProfile


class CleaningServiceError(Exception):
    """Raised when a cleaning operation cannot be completed."""


def get_original_file(dataset_id: str) -> Path:
    if not dataset_id or any(
        character not in "0123456789abcdef-"
        for character in dataset_id.lower()
    ):
        raise CleaningServiceError("Invalid dataset ID.")

    directory = settings.storage_dir / dataset_id

    if not directory.is_dir():
        raise FileNotFoundError("Dataset was not found.")

    files = list(directory.glob("original.*"))

    if not files:
        raise FileNotFoundError("Original dataset file was not found.")

    return files[0]


def _parse_numeric_series(series: pd.Series) -> pd.Series:
    """Parse common currency and formatted numeric strings for safe cleaning."""
    if is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    values = series.astype("string").str.strip()
    values = values.str.replace(r"[$€£₹,\s%]", "", regex=True)
    values = values.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
    return pd.to_numeric(values, errors="coerce")


def _is_numeric_semantic(series: pd.Series, semantic_type: str) -> bool:
    """Require actual parseable numeric evidence, not just a guessed label.

    A text field accidentally labelled numeric (e.g., sales_channel) must
    never turn into an all-null column during automatic cleaning.
    """
    if semantic_type in {"identifier", "date"}:
        return False
    valid = int(series.notna().sum())
    if valid == 0:
        return False
    parsed = _parse_numeric_series(series)
    return int(parsed.notna().sum()) / valid >= 0.80


def _validated_numeric_series(series: pd.Series, column: str) -> pd.Series:
    """Reject silent destruction of non-null text during numeric conversion."""
    parsed = _parse_numeric_series(series)
    invalid = int((series.notna() & parsed.isna()).sum())
    if invalid:
        raise CleaningServiceError(
            f"'{column}' contains {invalid} non-empty value(s) that cannot be "
            "converted to numbers. Review or fix those source values before "
            "numeric imputation/outlier capping; no values were overwritten."
        )
    return parsed


def suggest_strategy(series: pd.Series, semantic_type: str) -> tuple[str, str]:
    missing_count = int(series.isna().sum())
    missing_ratio = missing_count / max(len(series), 1)
    valid_count = int(series.notna().sum())

    if semantic_type in {"identifier", "date"}:
        return "leave", (
            "Identifiers and dates should not be automatically imputed."
        )

    # High-missingness columns require investigation, not automatic filling.
    # In particular, never turn a column with 50-99% missing values into
    # synthetic values by default: this can distort business conclusions.
    if valid_count == 0:
        return "leave", "The column contains no valid observations. Preserve it and investigate the source."
    if missing_ratio >= 0.50:
        return "leave", (
            f"{missing_ratio:.1%} of this column is missing. Do not auto-impute; "
            "investigate the source, missingness pattern and business meaning first."
        )

    if _is_numeric_semantic(series, semantic_type):
        invalid = int((series.notna() & _parse_numeric_series(series).isna()).sum())
        if invalid:
            return "leave", (
                f"{invalid} existing value(s) are not parseable as numbers. "
                "Review invalid formats before numeric cleaning to avoid data loss."
            )
        return "median", (
            "Median imputation is less sensitive to extreme values than mean. Numeric-looking values will be parsed before filling."
        )

    if semantic_type in {"numeric", "revenue", "price", "quantity"}:
        return "leave", (
            "This column was labelled numeric but the observed values are not reliably numeric. "
            "Verify its semantic type before any imputation."
        )

    if not series.dropna().empty:
        return "mode", (
            "The most frequent category is a reasonable initial suggestion."
        )

    return "leave", "No valid values are available for imputation."


def find_outliers(series: pd.Series) -> tuple[int, float, float]:
    numeric = pd.to_numeric(series, errors="coerce").dropna()

    if len(numeric) < 4:
        return 0, 0.0, 0.0

    q1 = float(numeric.quantile(0.25))
    q3 = float(numeric.quantile(0.75))
    iqr = q3 - q1

    if iqr == 0:
        return 0, q1, q3

    lower = q1 - (1.5 * iqr)
    upper = q3 + (1.5 * iqr)
    count = int(((numeric < lower) | (numeric > upper)).sum())

    return count, float(lower), float(upper)


# Recommend changes first; reviewing the preview must not alter the raw file.
def preview_cleaning(dataset_id: str) -> CleaningPreviewResponse:
    file_path = get_original_file(dataset_id)
    dataframe = load_dataset(file_path)
    profile = get_dataset_profile(dataset_id)

    recommendations = []

    semantic_types = {
        column.name: column.semantic_type
        for column in profile.column_profiles
    }

    for column in dataframe.columns:
        missing_count = int(dataframe[column].isna().sum())

        if missing_count == 0:
            continue

        strategy, reason = suggest_strategy(
            dataframe[column],
            semantic_types.get(column, "unknown"),
        )

        recommendations.append(
            CleaningRecommendation(
                column=column,
                missing_count=missing_count,
                suggested_strategy=strategy,
                reason=reason,
            )
        )

    outliers = []

    for column in dataframe.columns:
        if semantic_types.get(column) == "identifier":
            continue
        if not _is_numeric_semantic(dataframe[column], semantic_types.get(column, "unknown")):
            continue

        count, lower, upper = find_outliers(_parse_numeric_series(dataframe[column]))

        if count > 0:
            outliers.append(
                OutlierProfile(
                    column=column,
                    outlier_count=count,
                    lower_bound=round(lower, 4),
                    upper_bound=round(upper, 4),
                )
            )

    notes = [
        "These are automated suggestions. Review them before applying.",
        "IQR outliers are potential anomalies, not necessarily errors.",
        "The original uploaded file will not be modified.",
    ]

    return CleaningPreviewResponse(
        dataset_id=dataset_id,
        rows=len(dataframe),
        columns=len(dataframe.columns),
        missing_cells=int(dataframe.isna().sum().sum()),
        duplicate_rows=int(dataframe.duplicated().sum()),
        recommendations=recommendations,
        outliers=outliers,
        notes=notes,
    )


def apply_cleaning(
    dataframe: pd.DataFrame,
    request: CleaningApplyRequest,
    semantic_types: dict[str, str],
) -> tuple[pd.DataFrame, list[str], int]:
    # Work on a copy, so a bad cleaning rule cannot overwrite the upload.
    cleaned = dataframe.copy()
    actions = []

    requested_columns = (
        set(request.column_strategies)
        | set(request.outlier_strategies)
    )

    unknown_columns = requested_columns - set(cleaned.columns)

    if unknown_columns:
        raise CleaningServiceError(
            f"Unknown column(s): {', '.join(sorted(unknown_columns))}"
        )

    for column in cleaned.columns:
        if not cleaned[column].isna().any():
            continue

        default_strategy, _ = suggest_strategy(
            cleaned[column],
            semantic_types.get(column, "unknown"),
        )

        strategy = request.column_strategies.get(
            column,
            default_strategy,
        )

        if strategy == "leave":
            actions.append(f"Left missing values in '{column}' unchanged.")
            continue

        if strategy == "drop_rows":
            before = len(cleaned)
            cleaned = cleaned.dropna(subset=[column])
            removed = before - len(cleaned)
            actions.append(
                f"Removed {removed} row(s) with missing '{column}'."
            )
            continue

        if strategy in {"median", "mean"}:
            if not _is_numeric_semantic(cleaned[column], semantic_types.get(column, "unknown")):
                raise CleaningServiceError(
                    f"Strategy '{strategy}' requires a numeric column: "
                    f"'{column}'."
                )
            cleaned[column] = _validated_numeric_series(cleaned[column], column)

            if cleaned[column].dropna().empty:
                actions.append(
                    f"Could not fill '{column}': no valid values exist."
                )
                continue

            fill_value = (
                cleaned[column].median()
                if strategy == "median"
                else cleaned[column].mean()
            )
        else:
            modes = cleaned[column].mode(dropna=True)

            if modes.empty:
                actions.append(
                    f"Could not fill '{column}': no valid values exist."
                )
                continue

            fill_value = modes.iloc[0]

        missing_before = int(cleaned[column].isna().sum())
        cleaned[column] = cleaned[column].fillna(fill_value)

        actions.append(
            f"Filled {missing_before} missing value(s) in "
            f"'{column}' using {strategy}."
        )

    for column, strategy in request.outlier_strategies.items():
        if strategy == "keep":
            continue

        if not _is_numeric_semantic(cleaned[column], semantic_types.get(column, "unknown")):
            raise CleaningServiceError(
                f"IQR capping requires a numeric column: '{column}'."
            )
        cleaned[column] = _validated_numeric_series(cleaned[column], column)
        count, lower, upper = find_outliers(cleaned[column])

        if count == 0:
            actions.append(f"No IQR outliers found in '{column}'.")
            continue

        cleaned[column] = cleaned[column].clip(
            lower=lower,
            upper=upper,
        )

        actions.append(
            f"Capped {count} potential outlier value(s) in "
            f"'{column}' using IQR bounds."
        )

    removed_duplicates = 0

    if request.remove_duplicates:
        before = len(cleaned)
        cleaned = cleaned.drop_duplicates().reset_index(drop=True)
        removed_duplicates = before - len(cleaned)

        actions.append(
            f"Removed {removed_duplicates} duplicate row(s)."
        )
    else:
        actions.append("Duplicate rows were retained.")

    return cleaned, actions, removed_duplicates


def run_cleaning(
    dataset_id: str,
    request: CleaningApplyRequest,
) -> CleaningApplyResponse:
    file_path = get_original_file(dataset_id)
    original = load_dataset(file_path)
    original_profile = DatasetProfile.model_validate_json(
        (file_path.parent / "profile.json").read_text(encoding="utf-8")
    )

    semantic_types = {
        column.name: column.semantic_type
        for column in original_profile.column_profiles
    }

    cleaned, actions, removed_duplicates = apply_cleaning(
        dataframe=original,
        request=request,
        semantic_types=semantic_types,
    )

    cleaned_profile = profile_dataset(
        dataframe=cleaned,
        dataset_id=dataset_id,
        filename=original_profile.filename,
        file_type="csv",
    )

    output_path = file_path.parent / "cleaned.csv"
    cleaned.to_csv(output_path, index=False, encoding="utf-8-sig")
    (file_path.parent / "cleaned_profile.json").write_text(
        json.dumps(cleaned_profile.model_dump(mode="json"), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    response = CleaningApplyResponse(
        message="Dataset cleaned successfully.",
        dataset_id=dataset_id,
        original_rows=len(original),
        cleaned_rows=len(cleaned),
        removed_duplicate_rows=removed_duplicates,
        before_missing_cells=original_profile.missing_cells,
        after_missing_cells=cleaned_profile.missing_cells,
        before_quality_score=original_profile.quality_score,
        after_quality_score=cleaned_profile.quality_score,
        actions=actions,
        output_filename="cleaned.csv",
    )

    report_path = file_path.parent / "cleaning_report.json"
    report_path.write_text(
        json.dumps(response.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    return response
