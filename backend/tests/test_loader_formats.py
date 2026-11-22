import json
from pathlib import Path

import pandas as pd
import pytest

from app.data.ingestion import DatasetLoadError, load_dataset


def test_json_array_loads_records(tmp_path: Path):
    path = tmp_path / "rows.json"
    path.write_text(json.dumps([{"name": "A", "sales": 3}, {"name": "B", "sales": 5}]))
    frame = load_dataset(path)
    assert frame.shape == (2, 2)
    assert frame["sales"].sum() == 8


def test_json_data_envelope_loads(tmp_path: Path):
    path = tmp_path / "wrapped.json"
    path.write_text(json.dumps({"data": [{"x": 1}, {"x": 2}]}))
    assert load_dataset(path)["x"].tolist() == [1, 2]


def test_jsonl_loads_line_delimited_records(tmp_path: Path):
    path = tmp_path / "rows.jsonl"
    path.write_text('{"x":1}\n{"x":2}\n')
    assert load_dataset(path)["x"].tolist() == [1, 2]


def test_csv_detects_semicolon_delimiter(tmp_path: Path):
    path = tmp_path / "rows.csv"
    path.write_text("name;sales\nA;3\nB;5\n", encoding="utf-8")
    frame = load_dataset(path)
    assert list(frame.columns) == ["name", "sales"]
    assert frame["sales"].sum() == 8


def test_rejects_invalid_json_shape(tmp_path: Path):
    path = tmp_path / "bad.json"
    path.write_text('{"not_records": true}')
    with pytest.raises(DatasetLoadError):
        load_dataset(path)
