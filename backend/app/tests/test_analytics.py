
import json

import pandas as pd

from app.config import settings
from app.modules.understanding.profiler import profile_dataset
from app.services.analytics_service import (
    calculate_breakdown,
    calculate_correlations,
    calculate_overview,
    calculate_trend,
)


def create_test_dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)

    dataset_id = "a529a5fd-bf50-4b0d-bb0c-bff6eeed2313"
    directory = tmp_path / dataset_id
    directory.mkdir()

    dataframe = pd.DataFrame(
        {
            "order_id": ["O1", "O2", "O3", "O4"],
            "order_date": [
                "2024-01-05",
                "2024-01-15",
                "2024-02-05",
                "2024-02-15",
            ],
            "product": ["Laptop", "Mouse", "Laptop", "Mouse"],
            "category": ["Electronics", "Electronics", "Electronics", "Accessories"],
            "quantity": [2, 3, 1, 4],
            "revenue": [2000, 300, 1000, 400],
        }
    )

    file_path = directory / "original.csv"
    dataframe.to_csv(file_path, index=False)

    profile = profile_dataset(
        dataframe,
        dataset_id,
        "analytics.csv",
        "csv",
    )

    (directory / "profile.json").write_text(
        json.dumps(profile.model_dump(mode="json")),
        encoding="utf-8",
    )

    return dataset_id


def test_analytics_overview(tmp_path, monkeypatch):
    dataset_id = create_test_dataset(tmp_path, monkeypatch)

    result = calculate_overview(dataset_id)

    assert result.rows == 4
    assert result.columns == 6

    revenue_metric = next(
        metric for metric in result.metrics
        if metric.name == "Total Revenue"
    )

    assert revenue_metric.value == 3700


def test_category_breakdown(tmp_path, monkeypatch):
    dataset_id = create_test_dataset(tmp_path, monkeypatch)

    result = calculate_breakdown(
        dataset_id,
        group_by="category",
        metric="revenue",
        aggregation="sum",
    )

    assert result.results[0]["group"] == "Electronics"
    assert result.results[0]["value"] == 3300


def test_monthly_revenue_trend(tmp_path, monkeypatch):
    dataset_id = create_test_dataset(tmp_path, monkeypatch)

    result = calculate_trend(
        dataset_id,
        date_column="order_date",
        metric="revenue",
        frequency="month",
    )

    assert len(result.results) == 2
    assert result.results[0]["value"] == 2300
    assert result.results[1]["value"] == 1400


def test_numeric_correlations(tmp_path, monkeypatch):
    dataset_id = create_test_dataset(tmp_path, monkeypatch)

    result = calculate_correlations(dataset_id)

    assert "quantity" in result.columns
    assert "revenue" in result.columns
    assert len(result.matrix) >= 2
