"""A wrong semantic label must not destroy observed text values."""
import pandas as pd
import pytest
from app.cleaning import CleaningServiceError, apply_cleaning, suggest_strategy
from app.schemas.cleaning import CleaningApplyRequest


def test_guessed_numeric_sales_channel_is_preserved():
    frame = pd.DataFrame({'sales_channel': ['Online', None, 'Store', 'Online']})
    strategy, reason = suggest_strategy(frame['sales_channel'], 'numeric')
    assert strategy == 'leave'
    cleaned, _, _ = apply_cleaning(frame, CleaningApplyRequest(remove_duplicates=False), {'sales_channel': 'numeric'})
    assert cleaned['sales_channel'].iloc[0] == 'Online'
    assert cleaned['sales_channel'].iloc[2] == 'Store'
    assert cleaned['sales_channel'].isna().sum() == 1


def test_bad_numeric_tokens_cannot_be_overwritten_by_median():
    frame = pd.DataFrame({'revenue': ['$10.00', 'not-a-number', None, '$20.00']})
    strategy, reason = suggest_strategy(frame['revenue'], 'revenue')
    assert strategy == 'leave'
    with pytest.raises(CleaningServiceError, match='requires a numeric column|cannot be converted'):
        apply_cleaning(frame, CleaningApplyRequest(column_strategies={'revenue': 'median'}), {'revenue': 'revenue'})
    assert frame['revenue'].iloc[1] == 'not-a-number'


def test_currency_still_parses_without_changing_bad_labels():
    frame = pd.DataFrame({'revenue': ['$10.00', None, '₹30.00']})
    cleaned, _, _ = apply_cleaning(frame, CleaningApplyRequest(column_strategies={'revenue': 'median'}), {'revenue': 'revenue'})
    assert cleaned['revenue'].iloc[1] == 20.0
