"""Regression checks for the common admin preview/published report data contract."""
import uuid
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

from app.api import portal
from app.config import settings
from app.data.dataset_service import analyse_saved_dataset


def test_report_preview_follows_approved_cleaned_source(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)
    monkeypatch.setattr(portal, "authenticate_request", lambda request, roles: {"role": "admin"})
    dataset_id = str(uuid.uuid4())
    folder = tmp_path / dataset_id
    folder.mkdir()
    original = folder / "original.csv"
    pd.DataFrame({
        "order_date": pd.date_range("2025-01-01", periods=12, freq="MS").astype(str),
        "product_name": ["Notebook"] * 12,
        "category": ["Office"] * 12,
        "region": ["North"] * 12,
        "quantity_sold": [2] * 12,
        "unit_price": [100] * 12,
        "revenue": [200] * 12,
    }).to_csv(original, index=False)
    analyse_saved_dataset(original, dataset_id, "test.csv")
    raw = portal.preview_report(dataset_id, SimpleNamespace(), "auto")
    assert raw["source"] == "original"
    assert raw["overview"]["rows"] == 12
    cleaned = pd.read_csv(original).iloc[:10]
    cleaned.to_csv(folder / "cleaned.csv", index=False)
    cleaned_report = portal.preview_report(dataset_id, SimpleNamespace(), "auto")
    assert cleaned_report["source"] == "cleaned"
    assert cleaned_report["overview"]["rows"] == 10
    assert len(pd.read_csv(original)) == 12  # raw is not overwritten
    for key in ("overview", "decision", "charts", "trend", "forecast", "segment_forecasts"):
        assert key in cleaned_report
