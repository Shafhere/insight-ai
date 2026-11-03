import re

import pandas as pd
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
)

SEMANTIC_KEYWORDS = {
    "identifier": ["id", "identifier", "code", "reference", "invoice", "transaction"],
    "date": ["date", "time", "timestamp", "month", "year"],
    "revenue": ["revenue", "sales", "turnover", "income", "sales_value"],
    "quantity": ["quantity", "qty", "units", "stock", "inventory"],
    "price": ["price", "cost", "amount", "fee", "rate"],
    "customer": ["customer", "client", "buyer"],
    "product": ["product", "item", "sku"],
    "category": ["category", "type", "department", "segment"],
    "location": ["city", "state", "country", "region", "location", "branch"],
    "patient": ["patient", "diagnosis", "admission", "discharge"],
}


def _tokens(column_name: str) -> list[str]:
    name = re.sub(r"([a-z])([A-Z])", r"\1_\2", column_name)
    name = re.sub(r"[^a-zA-Z0-9]+", "_", name).lower()
    return [part for part in name.split("_") if part]


def _numeric_sample(series: pd.Series) -> bool:
    sample = series.dropna().astype(str).str.strip().head(500)
    if sample.empty:
        return False
    cleaned = sample.str.replace(r"[$€£₹,\s%]", "", regex=True)
    cleaned = cleaned.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
    parsed = pd.to_numeric(cleaned, errors="coerce")
    return parsed.notna().mean() >= 0.80


def infer_semantic_type(column_name: str, series: pd.Series) -> str:
    tokens = _tokens(column_name)
    token_set = set(tokens)
    joined = "_".join(tokens)

    # Identifier detection must precede generic semantic keywords.
    if (
        "id" in token_set
        or "identifier" in token_set
        or "invoice" in token_set
        or "transaction" in token_set
        or ("order" in token_set and "number" in token_set)
    ):
        return "identifier"

    for semantic_type, keywords in SEMANTIC_KEYWORDS.items():
        if semantic_type == "identifier":
            continue
        if any(keyword in token_set or keyword in joined for keyword in keywords):
            return semantic_type

    if is_bool_dtype(series):
        return "boolean"
    if is_datetime64_any_dtype(series):
        return "date"
    if is_numeric_dtype(series) or _numeric_sample(series):
        return "numeric"
    if series.nunique(dropna=True) <= 20:
        return "categorical"
    return "text"


def infer_data_type(series: pd.Series) -> str:
    if is_bool_dtype(series):
        return "boolean"
    if is_numeric_dtype(series):
        return "numeric"
    if is_datetime64_any_dtype(series):
        return "datetime"

    sample = series.dropna().head(500)
    if not sample.empty:
        parsed_dates = pd.to_datetime(sample, errors="coerce", format="mixed")
        if parsed_dates.notna().mean() >= 0.80:
            return "datetime"
        cleaned = sample.astype(str).str.strip().str.replace(
            r"[$€£₹,\s%]", "", regex=True
        )
        cleaned = cleaned.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        parsed_numbers = pd.to_numeric(cleaned, errors="coerce")
        if parsed_numbers.notna().mean() >= 0.80:
            return "numeric"

    return "categorical" if series.nunique(dropna=True) <= 20 else "text"
