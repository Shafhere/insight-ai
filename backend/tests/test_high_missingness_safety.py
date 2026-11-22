import pandas as pd

from app.cleaning import suggest_strategy


def test_high_missingness_numeric_column_is_not_imputed():
    values = pd.Series([42.0] + [None] * 98 + [None])
    strategy, reason = suggest_strategy(values, "numeric")
    assert strategy == "leave"
    assert "investigate" in reason.lower()


def test_moderate_missingness_numeric_column_can_suggest_median():
    values = pd.Series([10.0, 12.0, None, 14.0, 16.0])
    strategy, reason = suggest_strategy(values, "numeric")
    assert strategy == "median"
    assert "median" in reason.lower()
