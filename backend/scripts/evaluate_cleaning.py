"""Measure before/after cleaning effects for CSV using the actual cleaning engine.

Example from backend:
 python scripts/evaluate_cleaning.py --csv C:\\Data\\retail.csv --output cleaning_evaluation_result.json

This is a quantitative audit, not a claim that every transformed value is correct.
The input CSV is never overwritten; the modified dataframe exists only in memory.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd
from app.cleaning import apply_cleaning, suggest_strategy
from app.schemas.cleaning import CleaningApplyRequest


def semantic_guess(column: str, series: pd.Series) -> str:
    name = column.lower()
    if any(word in name for word in ('_id', 'identifier', 'order_id', 'customer_id', 'product_id')):
        return 'identifier'
    if 'date' in name or 'timestamp' in name:
        return 'date'
    if any(word in name for word in ('channel', 'segment', 'method', 'status', 'name', 'city', 'region', 'category', 'subcategory', 'type')):
        return 'category'
    if any(word in name for word in ('revenue', 'price', 'profit', 'amount', 'cost', 'spend', 'quantity', 'qty', 'units')) or name in {'sales', 'net_sales', 'total_sales'}:
        return 'numeric'
    return 'numeric' if pd.api.types.is_numeric_dtype(series) else 'category'


def evaluate_csv(csv: Path, cap_outliers: bool = False) -> dict:
    # Read without changing the file. BOM and formatted currencies supported by the engine.
    original_bytes = csv.read_bytes()
    frame = pd.read_csv(csv, low_memory=False, encoding='utf-8-sig')
    semantic = {col: semantic_guess(col, frame[col]) for col in frame.columns}
    defaults = {col: suggest_strategy(frame[col], semantic[col])[0] for col in frame.columns}
    outlier_strategies = ({c: 'cap_iqr' for c in frame.columns if semantic[c] == 'numeric'}
                          if cap_outliers else {})
    request = CleaningApplyRequest(remove_duplicates=True, outlier_strategies=outlier_strategies)
    cleaned, actions, removed = apply_cleaning(frame, request, semantic)
    assert csv.read_bytes() == original_bytes, 'Source changed during audit!'
    before_missing = int(frame.isna().sum().sum())
    after_missing = int(cleaned.isna().sum().sum())
    before_dup = int(frame.duplicated().sum())
    after_dup = int(cleaned.duplicated().sum())
    # Compare preserved identifiers, explicitly allowing duplicate-row removals only.
    id_cols = [c for c in frame.columns if semantic[c] == 'identifier']
    id_missing_before = sum(int(frame[c].isna().sum()) for c in id_cols)
    id_missing_after = sum(int(cleaned[c].isna().sum()) for c in id_cols)
    return {
        'dataset': csv.name, 'audit_mode': 'heuristic semantics from names; NOT an independent human ground truth',
        'input_unchanged': True, 'source_rows': int(len(frame)), 'clean_rows': int(len(cleaned)),
        'source_columns': int(len(frame.columns)), 'clean_columns': int(len(cleaned.columns)),
        'source_missing_cells': before_missing, 'clean_missing_cells': after_missing,
        'missing_cells_reduced': before_missing - after_missing,
        'source_duplicate_rows': before_dup, 'clean_duplicate_rows': after_dup,
        'duplicates_removed': int(removed),
        'identifier_missing_before': id_missing_before, 'identifier_missing_after': id_missing_after,
        'suggested_strategies': defaults,
        'actions': actions,
        'passes': {
            'raw_input_preserved': True,
            'schema_preserved': list(frame.columns) == list(cleaned.columns),
            'duplicate_count_not_increased': after_dup <= before_dup,
            'missingness_not_increased': after_missing <= before_missing,
        },
        'limitations': [
            'A lower missing-value count is not proof that imputation is semantically correct.',
            'Malformed dates, business-rule inconsistencies and data drift need separate labelled checks.',
            'Numeric strings can be formatted inconsistently; validate conversion and resulting totals independently.',
            'Outliers are kept unless --cap-outliers is explicitly requested; automatic capping can destroy legitimate extreme sales.',
            'Column semantics in this benchmark are heuristics; the application uses detected profile semantics during normal cleaning.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', required=True, type=Path)
    parser.add_argument('--output', default='cleaning_evaluation_result.json', type=Path)
    parser.add_argument('--cap-outliers', action='store_true')
    args = parser.parse_args()
    report = evaluate_csv(args.csv, args.cap_outliers)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if isinstance(v, (int, bool, str))}, indent=2))
    print('Saved:', args.output)


if __name__ == '__main__':
    main()
