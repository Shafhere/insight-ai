"""Regression: approved cleaning changes every downstream calculation, not the raw file."""
import json
import uuid

import pandas as pd

from app.config import settings
from app.analytics.service import load_analytics_dataset
from app.analytics.query_service import load_full_dataset
from app.data.dataset_service import get_dataset_profile
from app.data.profiling import profile_dataset


def test_cleaned_dataset_is_active_and_original_is_preserved(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)
    dataset_id = str(uuid.uuid4())
    folder = tmp_path / dataset_id
    folder.mkdir()
    original = pd.DataFrame({"quantity": [1, 2, 3], "product": ["A", "B", "C"]})
    cleaned = pd.DataFrame({"quantity": [1, 2, 8], "product": ["A", "B", "C"]})
    original.to_csv(folder / "original.csv", index=False)
    original_profile = profile_dataset(original, dataset_id, "sales.csv", "csv")
    (folder / "profile.json").write_text(json.dumps(original_profile.model_dump(mode="json")))

    assert load_full_dataset(dataset_id)["quantity"].sum() == 6
    cleaned.to_csv(folder / "cleaned.csv", index=False)
    cleaned_profile = profile_dataset(cleaned, dataset_id, "cleaned.csv", "csv")
    (folder / "cleaned_profile.json").write_text(json.dumps(cleaned_profile.model_dump(mode="json")))

    assert load_analytics_dataset(dataset_id, "original")["quantity"].sum() == 11
    assert load_full_dataset(dataset_id)["quantity"].sum() == 11
    assert load_analytics_dataset(dataset_id, "raw")["quantity"].sum() == 6
    assert get_dataset_profile(dataset_id).filename == "cleaned.csv"
    assert pd.read_csv(folder / "original.csv")["quantity"].sum() == 6
