"""Load supported structured datasets into a Pandas DataFrame."""
import json
from pathlib import Path

import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xlsm", ".json", ".jsonl", ".ndjson"}


class DatasetLoadError(Exception):
    """Raised when an uploaded dataset cannot be loaded."""


def _load_json_records(file_path: Path) -> pd.DataFrame:
    if file_path.suffix.lower() in {".jsonl", ".ndjson"}:
        records = []
        with file_path.open("r", encoding="utf-8-sig") as stream:
            for line_number, line in enumerate(stream, start=1):
                if line.strip():
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError as exc:
                        raise DatasetLoadError(f"Invalid JSON on line {line_number}: {exc.msg}") from exc
    else:
        with file_path.open("r", encoding="utf-8-sig") as stream:
            payload = json.load(stream)
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            records = payload.get("data", payload.get("records"))
            if records is None:
                raise DatasetLoadError("JSON object must contain a 'data' or 'records' array.")
        else:
            raise DatasetLoadError("JSON must contain an array of row objects.")
    if not isinstance(records, list) or not records or not all(isinstance(row, dict) for row in records):
        raise DatasetLoadError("JSON data must be a non-empty array of objects/records.")
    return pd.DataFrame.from_records(records)


def load_dataset(file_path: Path) -> pd.DataFrame:
    extension = file_path.suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise DatasetLoadError("Unsupported file format. Supported formats: CSV, XLSX, XLSM, JSON, JSONL.")
    try:
        if extension in {".json", ".jsonl", ".ndjson"}:
            dataframe = _load_json_records(file_path)
        elif extension == ".csv":
            try:
                dataframe = pd.read_csv(file_path, encoding="utf-8-sig", sep=None, engine="python")
            except UnicodeDecodeError:
                dataframe = pd.read_csv(file_path, encoding="cp1252", sep=None, engine="python")
        else:
            dataframe = pd.read_excel(file_path, engine="openpyxl")
    except DatasetLoadError:
        raise
    except Exception as exc:
        raise DatasetLoadError(f"Unable to read the uploaded dataset: {exc}") from exc
    if dataframe.empty:
        raise DatasetLoadError("The uploaded dataset contains no data.")
    if len(dataframe.columns) == 0:
        raise DatasetLoadError("The dataset has no columns.")
    dataframe.columns = [str(column).strip() for column in dataframe.columns]
    if any(not column for column in dataframe.columns):
        raise DatasetLoadError("The dataset contains an empty column name.")
    if dataframe.columns.duplicated().any():
        raise DatasetLoadError("The dataset contains duplicate column names. Rename them before upload.")
    return dataframe
