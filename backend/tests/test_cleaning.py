
import pandas as pd

from app.schemas.cleaning import CleaningApplyRequest
from app.cleaning import apply_cleaning


def test_median_imputation_and_duplicate_removal():
    dataframe = pd.DataFrame(
        {
            "sales": [10.0, None, 30.0, 30.0],
            "category": ["A", "A", "B", "B"],
        }
    )

    request = CleaningApplyRequest(
        column_strategies={"sales": "median"},
        remove_duplicates=True,
    )

    cleaned, actions, removed = apply_cleaning(
        dataframe,
        request,
        {"sales": "revenue", "category": "category"},
    )

    assert cleaned["sales"].isna().sum() == 0
    assert cleaned["sales"].iloc[1] == 30.0
    assert len(cleaned) == 3
    assert removed == 1
    assert len(actions) > 0


def test_iqr_outlier_capping():
    dataframe = pd.DataFrame(
        {"sales": [1, 2, 3, 4, 5, 100]}
    )

    request = CleaningApplyRequest(
        outlier_strategies={"sales": "cap_iqr"},
        remove_duplicates=False,
    )

    cleaned, actions, _ = apply_cleaning(
        dataframe,
        request,
        {"sales": "revenue"},
    )

    assert cleaned["sales"].max() < 100
    assert cleaned["sales"].iloc[-1] == 8.5
    assert any("outlier" in action.lower() for action in actions)


def test_identifier_missing_values_are_not_filled_automatically():
    dataframe = pd.DataFrame(
        {"customer_id": ["C001", None, "C003"]}
    )

    request = CleaningApplyRequest()

    cleaned, _, _ = apply_cleaning(
        dataframe,
        request,
        {"customer_id": "identifier"},
    )

    assert cleaned["customer_id"].isna().sum() == 1


def test_currency_formatted_values_can_be_median_imputed():
    dataframe = pd.DataFrame({"revenue": ["$10.00", None, "$30.00", "$50.00"]})
    request = CleaningApplyRequest(column_strategies={"revenue": "median"})
    cleaned, actions, _ = apply_cleaning(dataframe, request, {"revenue": "revenue"})
    assert cleaned["revenue"].isna().sum() == 0
    assert cleaned["revenue"].iloc[1] == 30.0
    assert any("median" in action.lower() for action in actions)
