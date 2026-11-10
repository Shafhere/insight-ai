
import joblib
import numpy as np
import pandas as pd
import pytest

from app.prediction.model_engine import (
    PredictiveEngineError,
    predict_saved_model,
    train_model,
)


def test_regression_model_training(tmp_path):
    dataframe = pd.DataFrame({
        "advertising": np.arange(100),
        "price": np.arange(100) * 2,
        "revenue": np.arange(100) * 5 + 10,
    })

    model_path = tmp_path / "model.joblib"

    result = train_model(
        dataframe,
        "revenue",
        model_path,
    )

    assert result["task"] == "regression"
    assert result["target_column"] == "revenue"
    assert "mae" in result["metrics"]
    assert "rmse" in result["metrics"]
    assert "r2" in result["metrics"]
    assert model_path.is_file()


def test_classification_model_training(tmp_path):
    dataframe = pd.DataFrame({
        "age": np.arange(100),
        "income": np.arange(100) * 100,
        "segment": ["A"] * 50 + ["B"] * 50,
    })

    result = train_model(
        dataframe,
        "segment",
        tmp_path / "classification.joblib",
    )

    assert result["task"] == "classification"
    assert "accuracy" in result["metrics"]
    assert "f1_weighted" in result["metrics"]


def test_missing_target_is_rejected(tmp_path):
    dataframe = pd.DataFrame({
        "feature": np.arange(30),
    })

    with pytest.raises(PredictiveEngineError):
        train_model(
            dataframe,
            "unknown_target",
            tmp_path / "model.joblib",
        )


def test_small_dataset_is_rejected(tmp_path):
    dataframe = pd.DataFrame({
        "feature": range(10),
        "target": range(10),
    })

    with pytest.raises(PredictiveEngineError):
        train_model(
            dataframe,
            "target",
            tmp_path / "model.joblib",
        )


def test_identifier_columns_are_removed(tmp_path):
    dataframe = pd.DataFrame({
        "order_id": [f"ORD-{i}" for i in range(100)],
        "customer_id": [f"C-{i}" for i in range(100)],
        "advertising": np.arange(100),
        "revenue": np.arange(100) * 5 + 10,
    })

    result = train_model(
        dataframe,
        "revenue",
        tmp_path / "model.joblib",
    )

    assert "order_id" not in result["features_used"]
    assert "customer_id" not in result["features_used"]
    assert "advertising" in result["features_used"]


def test_date_columns_are_engineered(tmp_path):
    dataframe = pd.DataFrame({
        "order_date": pd.date_range(
            "2024-01-01",
            periods=800,
            freq="D",
        ),
        "advertising": np.arange(800),
        "revenue": np.arange(800) * 5 + 10,
    })

    model_path = tmp_path / "date_model.joblib"

    report = train_model(
        dataframe=dataframe,
        target_column="revenue",
        model_path=model_path,
        task="regression",
    )

    assert "order_date_year" in report["features_used"]
    assert "order_date_month" in report["features_used"]
    assert "order_date_day" in report["features_used"]
    assert "order_date_weekday" in report["features_used"]
    assert "order_date" not in report["features_used"]
    
def test_explicit_classification_for_numeric_target(tmp_path):
    dataframe = pd.DataFrame({
        "feature": np.arange(100),
        "target": [0, 1] * 50,
    })

    result = train_model(
        dataframe,
        "target",
        tmp_path / "numeric_classification.joblib",
        task="classification",
    )

    assert result["task"] == "classification"
    assert "accuracy" in result["metrics"]


def test_explicit_regression_for_numeric_target(tmp_path):
    dataframe = pd.DataFrame({
        "feature": np.arange(100),
        "target": np.tile([0, 1], 50),
    })

    result = train_model(
        dataframe,
        "target",
        tmp_path / "numeric_regression.joblib",
        task="regression",
    )

    assert result["task"] == "regression"
    assert "mae" in result["metrics"]


def test_invalid_task_is_rejected(tmp_path):
    dataframe = pd.DataFrame({
        "feature": np.arange(30),
        "target": np.arange(30),
    })

    with pytest.raises(PredictiveEngineError):
        train_model(
            dataframe,
            "target",
            tmp_path / "model.joblib",
            task="invalid",
        )


def test_saved_model_can_be_loaded(tmp_path):
    dataframe = pd.DataFrame({
        "advertising": np.arange(100),
        "price": np.arange(100) * 2,
        "revenue": np.arange(100) * 5 + 10,
    })

    model_path = tmp_path / "saved_model.joblib"

    train_model(
        dataframe,
        "revenue",
        model_path,
    )

    loaded_model = joblib.load(model_path)

    predictions = loaded_model.predict(
        pd.DataFrame({
            "advertising": [101, 102],
            "price": [202, 204],
        })
    )

    assert len(predictions) == 2

def test_saved_model_can_predict_new_records(tmp_path):
    dataframe = pd.DataFrame({
        "advertising": np.arange(100),
        "price": np.arange(100) * 2,
        "revenue": np.arange(100) * 5 + 10,
    })

    model_path = tmp_path / "model.joblib"

    train_model(
        dataframe,
        "revenue",
        model_path,
    )

    new_records = pd.DataFrame({
        "advertising": [101, 102],
        "price": [202, 204],
    })

    predictions = predict_saved_model(
        new_records,
        model_path,
    )

    assert len(predictions) == 2
    assert all(isinstance(value, (int, float)) for value in predictions)


def test_saved_model_handles_missing_and_extra_features(tmp_path):
    dataframe = pd.DataFrame({
        "advertising": np.arange(100),
        "price": np.arange(100) * 2,
        "revenue": np.arange(100) * 5 + 10,
    })

    model_path = tmp_path / "model.joblib"

    train_model(
        dataframe,
        "revenue",
        model_path,
    )

    new_records = pd.DataFrame({
        "advertising": [101, 102],
        "unexpected_column": ["A", "B"],
    })

    predictions = predict_saved_model(
        new_records,
        model_path,
    )

    assert len(predictions) == 2


def test_prediction_without_trained_model_is_rejected(tmp_path):
    new_records = pd.DataFrame({
        "advertising": [100],
    })

    with pytest.raises(PredictiveEngineError):
        predict_saved_model(
            new_records,
            tmp_path / "missing_model.joblib",
        )