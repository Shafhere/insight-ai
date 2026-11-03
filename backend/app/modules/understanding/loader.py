from pathlib import Path

import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xlsm"}


class DatasetLoadError(Exception):
    """Raised when an uploaded dataset cannot be loaded."""


def load_dataset(file_path: Path) -> pd.DataFrame:
    extension = file_path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise DatasetLoadError("Unsupported file format.")

    try:
        if extension == ".csv":
            try:
                dataframe = pd.read_csv(file_path, encoding="utf-8-sig")
            except UnicodeDecodeError:
                dataframe = pd.read_csv(file_path, encoding="cp1252")

        else:
            dataframe = pd.read_excel(
                file_path,
                engine="openpyxl",
            )

    except Exception as exc:
        raise DatasetLoadError(
            f"Unable to read the uploaded dataset: {exc}"
        ) from exc

    if dataframe.empty:
        raise DatasetLoadError("The uploaded dataset contains no data.")

    if len(dataframe.columns) == 0:
        raise DatasetLoadError("The dataset has no columns.")

    dataframe.columns = [
        str(column).strip() for column in dataframe.columns
    ]

    if any(not column for column in dataframe.columns):
        raise DatasetLoadError(
            "The dataset contains an empty column name."
        )

    return dataframe