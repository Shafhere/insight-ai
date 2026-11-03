
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import (
    KFold,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor


class PredictiveEngineError(Exception):
    """Raised when predictive modelling cannot be completed."""


def _is_identifier_column(column: str) -> bool:
    """Identify columns that are likely record identifiers."""
    name = str(column).strip().lower()

    return (
        name == "id"
        or name.endswith("_id")
        or name.startswith("id_")
        or name.endswith("_uuid")
        or "identifier" in name
    )


def _prepare_date_features(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Convert recognizable date columns into numeric date features."""
    result = dataframe.copy()

    for column in list(result.columns):
        series = result[column]

        is_datetime = pd.api.types.is_datetime64_any_dtype(series)
        has_date_name = any(
            keyword in str(column).lower()
            for keyword in ("date", "datetime", "timestamp")
        )

        if not is_datetime and not has_date_name:
            continue

        parsed = pd.to_datetime(series, errors="coerce", utc=True)

        valid_count = int(parsed.notna().sum())
        valid_ratio = valid_count / max(len(series), 1)

        if valid_count == 0 or valid_ratio < 0.8:
            continue

        result[f"{column}_year"] = parsed.dt.year
        result[f"{column}_month"] = parsed.dt.month
        result[f"{column}_day"] = parsed.dt.day
        result[f"{column}_weekday"] = parsed.dt.dayofweek

        result = result.drop(columns=[column])

    return result


def _build_preprocessor(
    numeric_columns: list[str],
    categorical_columns: list[str],
) -> ColumnTransformer:
    """Build preprocessing pipelines for numeric and categorical data."""
    transformers = []

    if numeric_columns:
        numeric_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
        ])

        transformers.append((
            "numeric",
            numeric_pipeline,
            numeric_columns,
        ))

    if categorical_columns:
        categorical_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OneHotEncoder(handle_unknown="ignore"),
            ),
        ])

        transformers.append((
            "categorical",
            categorical_pipeline,
            categorical_columns,
        ))

    return ColumnTransformer(
        transformers=transformers,
        remainder="drop",
    )


def _get_model_candidates(task: str) -> list[tuple[str, Any]]:
    """Return candidate estimators for the selected task."""

    if task == "classification":
        return [
            (
                "Random Forest",
                RandomForestClassifier(
                    n_estimators=200,
                    random_state=42,
                    class_weight="balanced",
                    n_jobs=-1,
                ),
            ),
            (
                "Decision Tree",
                DecisionTreeClassifier(
                    random_state=42,
                    class_weight="balanced",
                ),
            ),
            (
                "Logistic Regression",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                ),
            ),
        ]

    return [
        (
            "Random Forest",
            RandomForestRegressor(
                n_estimators=200,
                random_state=42,
                n_jobs=-1,
            ),
        ),
        (
            "Decision Tree",
            DecisionTreeRegressor(
                random_state=42,
            ),
        ),
        (
            "Linear Regression",
            LinearRegression(),
        ),
    ]


def _get_feature_importance(
    pipeline: Pipeline,
) -> list[dict[str, Any]]:
    """Extract tree importance or absolute coefficient magnitude."""

    preprocessor = pipeline.named_steps["preprocessor"]
    model = pipeline.named_steps["model"]

    try:
        feature_names = preprocessor.get_feature_names_out()
    except (AttributeError, ValueError):
        return []

    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_)

    elif hasattr(model, "coef_"):
        coefficients = np.asarray(model.coef_)
        values = np.abs(coefficients)

        if values.ndim > 1:
            values = values.mean(axis=0)

    else:
        return []

    values = values.ravel()

    if len(feature_names) != len(values):
        return []

    ranked_features = sorted(
        zip(feature_names, values),
        key=lambda item: item[1],
        reverse=True,
    )

    return [
        {
            "feature": str(name),
            "importance": round(float(value), 4),
        }
        for name, value in ranked_features[:15]
    ]


def _validate_training_data(
    dataframe: pd.DataFrame,
    target_column: str,
) -> pd.DataFrame:
    """Validate and clean the dataset before model training."""

    if not isinstance(dataframe, pd.DataFrame) or dataframe.empty:
        raise PredictiveEngineError(
            "The dataset is empty or invalid."
        )

    if dataframe.columns.duplicated().any():
        raise PredictiveEngineError(
            "The dataset contains duplicate column names. "
            "Rename duplicate columns before training."
        )

    if target_column not in dataframe.columns:
        raise PredictiveEngineError(
            f"Target column '{target_column}' does not exist."
        )

    if len(dataframe) < 20:
        raise PredictiveEngineError(
            "At least 20 rows are required for this MVP model."
        )

    working = dataframe.copy()
    working = working.replace([np.inf, -np.inf], np.nan)

    working = working.dropna(subset=[target_column])

    if len(working) < 20:
        raise PredictiveEngineError(
            "Not enough valid target records remain for training."
        )

    return working


def _calculate_classification_metrics(
    y_test: pd.Series,
    predictions: np.ndarray,
) -> dict[str, float]:
    """Calculate classification evaluation metrics."""

    return {
        "accuracy": round(
            float(accuracy_score(y_test, predictions)),
            4,
        ),
        "precision_weighted": round(
            float(
                precision_score(
                    y_test,
                    predictions,
                    average="weighted",
                    zero_division=0,
                )
            ),
            4,
        ),
        "recall_weighted": round(
            float(
                recall_score(
                    y_test,
                    predictions,
                    average="weighted",
                    zero_division=0,
                )
            ),
            4,
        ),
        "f1_weighted": round(
            float(
                f1_score(
                    y_test,
                    predictions,
                    average="weighted",
                    zero_division=0,
                )
            ),
            4,
        ),
    }


def _calculate_regression_metrics(
    y_test: pd.Series,
    predictions: np.ndarray,
) -> dict[str, float | None]:
    """Calculate regression evaluation metrics."""

    r2 = float(r2_score(y_test, predictions))

    return {
        "mae": round(
            float(mean_absolute_error(y_test, predictions)),
            4,
        ),
        "rmse": round(
            float(
                np.sqrt(
                    mean_squared_error(y_test, predictions)
                )
            ),
            4,
        ),
        "r2": round(r2, 4) if np.isfinite(r2) else None,
    }


def train_model(
    dataframe: pd.DataFrame,
    target_column: str,
    model_path: Path,
    task: str = "auto",
) -> dict[str, Any]:
    """
    Compare candidate models, select the best, evaluate and save it.

    Classification selection uses weighted F1.
    Regression selection uses negative RMSE during cross-validation.
    Final evaluation uses a separate holdout test set.
    """

    task = str(task).strip().lower()

    if task not in {"auto", "classification", "regression"}:
        raise PredictiveEngineError(
            "Task must be 'auto', 'classification', or 'regression'."
        )

    working = _validate_training_data(
        dataframe,
        target_column,
    )

    y = working[target_column].copy()
    X = working.drop(columns=[target_column]).copy()

    if task == "auto":
        task = (
            "regression"
            if pd.api.types.is_numeric_dtype(y)
            else "classification"
        )

    if task == "regression":
        y = pd.to_numeric(y, errors="coerce")
        valid_target = y.notna()

        X = X.loc[valid_target].copy()
        y = y.loc[valid_target].astype(float)

        if len(X) < 20 or y.nunique() < 2:
            raise PredictiveEngineError(
                "Not enough valid numeric target records for regression."
            )

    else:
        # Preserve original labels, including numeric labels such as 0 and 1.
        # Scikit-learn supports numeric and categorical classification targets.
        if y.nunique() < 2:
            raise PredictiveEngineError(
                "Classification requires at least two target classes."
            )

        class_counts = y.value_counts()

        if class_counts.min() < 3:
            raise PredictiveEngineError(
                "Each target class needs at least three records "
                "for model comparison."
            )

    # Remove likely identifiers to reduce overfitting.
    identifier_columns = [
        column
        for column in X.columns
        if _is_identifier_column(column)
    ]

    X = X.drop(
        columns=identifier_columns,
        errors="ignore",
    )

    # Convert recognizable date columns into model-ready features.
    X = _prepare_date_features(X)

    # Remove columns containing only one unique value or no values.
    constant_columns = [
        column
        for column in X.columns
        if X[column].nunique(dropna=True) <= 1
    ]

    X = X.drop(
        columns=constant_columns,
        errors="ignore",
    )

    if X.empty:
        raise PredictiveEngineError(
            "No usable feature columns remain after preprocessing."
        )

    numeric_columns = X.select_dtypes(
        include="number"
    ).columns.tolist()

    categorical_columns = [
        column
        for column in X.columns
        if column not in numeric_columns
    ]

    # Check that the holdout split can contain every target class.
    stratify = y if task == "classification" else None

    try:
        if task == "classification":
            number_of_classes = int(y.nunique())
            test_rows = max(1, int(np.ceil(len(X) * 0.2)))
            train_rows = len(X) - test_rows

            if (
                test_rows < number_of_classes
                or train_rows < number_of_classes
            ):
                raise PredictiveEngineError(
                    "There are too many target classes for the "
                    "available training records. More data is required."
                )

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=stratify,
        )

        if task == "classification":
            minimum_class_count = int(
                y_train.value_counts().min()
            )

            cv_folds = min(5, minimum_class_count)

            if cv_folds < 2:
                raise PredictiveEngineError(
                    "Not enough training records per class "
                    "for cross-validation."
                )

            cv = StratifiedKFold(
                n_splits=cv_folds,
                shuffle=True,
                random_state=42,
            )

            scoring = "f1_weighted"
            cv_metric = "weighted_f1"

        else:
            cv_folds = min(5, len(X_train))

            if cv_folds < 2:
                raise PredictiveEngineError(
                    "Not enough training records for cross-validation."
                )

            cv = KFold(
                n_splits=cv_folds,
                shuffle=True,
                random_state=42,
            )

            scoring = "neg_root_mean_squared_error"
            cv_metric = "rmse"

        comparison = []
        best_pipeline = None
        best_model_name = None
        best_score = float("-inf")

        for model_name, estimator in _get_model_candidates(task):
            pipeline = Pipeline([
                (
                    "preprocessor",
                    _build_preprocessor(
                        numeric_columns,
                        categorical_columns,
                    ),
                ),
                ("model", estimator),
            ])

            scores = cross_val_score(
                pipeline,
                X_train,
                y_train,
                cv=cv,
                scoring=scoring,
                n_jobs=1,
                error_score="raise",
            )

            mean_score = float(np.mean(scores))
            std_score = float(np.std(scores))

            # Scikit-learn returns negative RMSE because higher
            # cross-validation scores are always considered better.
            if task == "classification":
                display_score = mean_score
            else:
                display_score = -mean_score

            comparison.append({
                "model_name": model_name,
                "cv_score_mean": round(display_score, 4),
                "cv_score_std": round(std_score, 4),
                "cv_metric": cv_metric,
            })

            # Higher weighted F1 or less negative RMSE is better.
            if mean_score > best_score:
                best_score = mean_score
                best_model_name = model_name
                best_pipeline = pipeline

        if best_pipeline is None:
            raise PredictiveEngineError(
                "No candidate model completed cross-validation."
            )

        # Fit the selected pipeline on the complete training split.
        best_pipeline.fit(X_train, y_train)

        # Evaluate on data that was not used for model selection.
        predictions = best_pipeline.predict(X_test)

    except PredictiveEngineError:
        raise

    except Exception as exc:
        raise PredictiveEngineError(
            f"Unable to compare or train candidate models: {exc}"
        ) from exc

    # Calculate holdout evaluation metrics.
    if task == "classification":
        metrics = _calculate_classification_metrics(
            y_test,
            predictions,
        )
    else:
        metrics = _calculate_regression_metrics(
            y_test,
            predictions,
        )

    # Extract explainability information from the selected model.
    importance = _get_feature_importance(best_pipeline)

    # Save the complete preprocessing + model pipeline.
    try:
        model_path = Path(model_path)
        model_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        joblib.dump(best_pipeline, model_path)

    except Exception as exc:
        raise PredictiveEngineError(
            f"Unable to save the trained model: {exc}"
        ) from exc

    # Classification: highest weighted F1 first.
    # Regression: lowest RMSE first.
    comparison.sort(
        key=lambda item: item["cv_score_mean"],
        reverse=(task == "classification"),
    )

    return {
        "task": task,
        "target_column": target_column,
        "training_rows": len(X_train),
        "testing_rows": len(X_test),
        "features_used": list(X.columns),
        "removed_identifier_columns": identifier_columns,
        "removed_constant_columns": constant_columns,
        "metrics": metrics,
        "feature_importance": importance,
        "model_name": best_model_name,
        "cv_folds": cv_folds,
        "cv_metric": cv_metric,
        "model_comparison": comparison,
    }


def predict_saved_model(
    dataframe: pd.DataFrame,
    model_path: Path,
) -> list[Any]:
    """
    Generate predictions using a previously saved training pipeline.

    The saved pipeline contains both the fitted preprocessor
    and the selected estimator.
    """

    if not isinstance(dataframe, pd.DataFrame) or dataframe.empty:
        raise PredictiveEngineError(
            "Provide at least one record for prediction."
        )

    if dataframe.columns.duplicated().any():
        raise PredictiveEngineError(
            "Prediction data contains duplicate column names."
        )

    model_path = Path(model_path)

    if not model_path.is_file():
        raise PredictiveEngineError(
            "No trained model found. Train a model first."
        )

    try:
        pipeline = joblib.load(model_path)

        if not isinstance(pipeline, Pipeline):
            raise PredictiveEngineError(
                "The saved model has an unsupported format."
            )

        if not hasattr(pipeline, "feature_names_in_"):
            raise PredictiveEngineError(
                "The saved model does not contain its training feature schema."
            )

        expected_features = list(
            pipeline.feature_names_in_
        )

        working = dataframe.copy()
        working = working.replace(
            [np.inf, -np.inf],
            np.nan,
        )

        identifier_columns = [
            column
            for column in working.columns
            if _is_identifier_column(column)
        ]

        working = working.drop(
            columns=identifier_columns,
            errors="ignore",
        )

        working = _prepare_date_features(working)

        # Align the prediction data with the exact training schema.
        # Missing expected features become NaN and are handled
        # by the fitted imputers. Extra columns are ignored.
        working = working.reindex(
            columns=expected_features
        )

        predictions = pipeline.predict(working)

        results = []

        for value in predictions:
            if isinstance(value, np.generic):
                value = value.item()

            if pd.isna(value):
                value = None

            results.append(value)

        return results

    except PredictiveEngineError:
        raise

    except Exception as exc:
        raise PredictiveEngineError(
            f"Unable to generate predictions: {exc}"
        ) from exc
