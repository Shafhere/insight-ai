import pandas as pd

from app.data.profiling import profile_dataset


def test_dataset_profiling():
    dataframe = pd.DataFrame(
        {
            "Product": ["Laptop", "Mouse", "Laptop"],
            "Sales": [50000, 1000, 50000],
            "Quantity": [2, 5, 2],
        }
    )

    profile = profile_dataset(
        dataframe=dataframe,
        dataset_id="test-dataset",
        filename="sales.csv",
        file_type="csv",
    )

    assert profile.rows == 3
    assert profile.columns == 3

    assert profile.duplicate_rows == 1
    assert profile.missing_cells == 0

    assert profile.quality_score < 100

    assert len(profile.column_profiles) == 3


def test_missing_values_are_detected():
    dataframe = pd.DataFrame(
        {
            "Sales": [100, None, 300],
            "Product": ["A", "B", None],
        }
    )

    profile = profile_dataset(
        dataframe=dataframe,
        dataset_id="test-missing",
        filename="missing.csv",
        file_type="csv",
    )

    assert profile.missing_cells == 2
    assert profile.missing_percentage > 0


def test_retail_domain_detection():
    dataframe = pd.DataFrame(
        {
            "Product": ["A", "B"],
            "Quantity": [10, 20],
            "Stock": [50, 60],
        }
    )

    profile = profile_dataset(
        dataframe=dataframe,
        dataset_id="test-retail",
        filename="retail.csv",
        file_type="csv",
    )

    assert profile.detected_domain == "retail"