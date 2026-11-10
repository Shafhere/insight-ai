
import pandas as pd
import pytest

from app.analytics import query_service as data_query_service


@pytest.fixture
def sample_dataframe():
    return pd.DataFrame({
        "product": ["Laptop", "Mouse", "Laptop", "Keyboard", "Mouse"],
        "revenue": [50000, 1000, 45000, 2000, 1500],
        "quantity": [2, 5, 1, 3, 4],
    })


@pytest.fixture
def mock_dataset(monkeypatch, sample_dataframe):
    monkeypatch.setattr(
        data_query_service,
        "load_full_dataset",
        lambda dataset_id: sample_dataframe.copy(),
    )


def test_dataset_overview_uses_all_rows(mock_dataset):
    result = data_query_service.get_dataset_overview("test-id")

    assert result["total_rows"] == 5
    assert result["total_columns"] == 3
    assert result["missing_cells"] == 0
    assert result["duplicate_rows"] == 0
    assert "revenue" in result["numeric_columns"]


def test_aggregate_total_revenue(mock_dataset):
    result = data_query_service.aggregate_column(
        dataset_id="test-id",
        column="revenue",
        aggregation="sum",
    )

    assert result["result"] == 99500
    assert result["non_null_values"] == 5


def test_aggregate_average_revenue(mock_dataset):
    result = data_query_service.aggregate_column(
        dataset_id="test-id",
        column="revenue",
        aggregation="mean",
    )

    assert result["result"] == 19900


def test_distinct_values_returns_all_products(mock_dataset):
    result = data_query_service.get_distinct_values(
        dataset_id="test-id",
        column="product",
        limit=100,
    )

    assert result["total_unique_values"] == 3
    assert set(result["values"]) == {
        "Laptop",
        "Mouse",
        "Keyboard",
    }
    assert result["truncated"] is False


def test_distinct_values_respects_limit(mock_dataset):
    result = data_query_service.get_distinct_values(
        dataset_id="test-id",
        column="product",
        limit=2,
    )

    assert result["total_unique_values"] == 3
    assert result["returned_values"] == 2
    assert result["truncated"] is True


def test_group_by_product_revenue(mock_dataset):
    result = data_query_service.group_by_column(
        dataset_id="test-id",
        group_by="product",
        metric="revenue",
        aggregation="sum",
        limit=20,
    )

    rows = result["results"]

    assert rows[0]["product"] == "Laptop"
    assert rows[0]["result"] == 95000
    assert rows[1]["product"] == "Mouse"
    assert rows[1]["result"] == 2500


def test_invalid_column_is_rejected(mock_dataset):
    with pytest.raises(ValueError, match="does not exist"):
        data_query_service.aggregate_column(
            dataset_id="test-id",
            column="unknown_column",
            aggregation="sum",
        )


def test_invalid_aggregation_is_rejected(mock_dataset):
    with pytest.raises(ValueError, match="Unsupported aggregation"):
        data_query_service.aggregate_column(
            dataset_id="test-id",
            column="revenue",
            aggregation="invalid",
        )
