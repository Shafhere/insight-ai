"""Regression: approved cleaning becomes the active source for the full application."""
import json
import uuid
import pandas as pd

from app.config import settings
from app.schemas.cleaning import CleaningApplyRequest
from app.data.profiling import profile_dataset
from app.data.dataset_service import get_dataset_profile
from app.cleaning.pipeline import run_cleaning
from app.analytics.service import load_analytics_dataset
from app.analytics.query_service import load_full_dataset


def test_cleaning_automatically_activates_cleaned_dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)
    dataset_id = str(uuid.uuid4())
    folder = tmp_path / dataset_id
    folder.mkdir()
    original = pd.DataFrame({
        "sale_date": ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
        "revenue": [10.0, None, 30.0, 50.0],
        "category": ["A", "A", "B", "C"],
    })
    original.to_csv(folder / "original.csv", index=False)
    profile = profile_dataset(original, dataset_id, "retail.csv", "csv")
    (folder / "profile.json").write_text(json.dumps(profile.model_dump(mode="json")))

    assert load_analytics_dataset(dataset_id, "original")["revenue"].isna().sum() == 1
    result = run_cleaning(dataset_id, CleaningApplyRequest(
        column_strategies={"revenue": "median"}, remove_duplicates=False
    ))
    assert result.after_missing_cells < result.before_missing_cells
    # Existing callers using default/original now transparently see approved data.
    assert load_analytics_dataset(dataset_id, "original")["revenue"].isna().sum() == 0
    assert load_full_dataset(dataset_id)["revenue"].isna().sum() == 0
    assert get_dataset_profile(dataset_id).missing_cells == 0
    # The raw source and its profile remain available and unmodified.
    assert load_analytics_dataset(dataset_id, "raw")["revenue"].isna().sum() == 1
    assert json.loads((folder / "profile.json").read_text())["missing_cells"] == 1
