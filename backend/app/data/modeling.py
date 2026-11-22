"""Preview and apply a left join without changing the sales grain."""

import re
import pandas as pd


def normalized(name):
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def keys(series):
    return series.astype("string").str.strip().replace("", pd.NA)


def relationships(sales, lookup):
    result = []
    for left in sales:
        if not any(token in normalized(left) for token in ("id", "sku", "code", "key")):
            continue
        for right in lookup:
            if normalized(left) == normalized(right):
                result.append(inspect(sales, lookup, left, right))
    return result


def inspect(sales, lookup, left, right):
    if left not in sales or right not in lookup:
        raise ValueError("Select an existing column from each file.")
    foreign, primary = keys(sales[left]), keys(lookup[right])
    matched = int(foreign.isin(primary.dropna()).sum())
    duplicates = int(primary.duplicated(keep=False).sum())
    return dict(
        cardinality="one-to-one" if foreign.dropna().is_unique else "many-to-one",
        left=left,
        right=right,
        matched=matched,
        unmatched=len(sales) - matched,
        duplicate_lookup_rows=duplicates,
        missing_lookup_keys=int(primary.isna().sum()),
        safe=bool(matched and primary.is_unique and primary.notna().all()),
    )


def join_tables(sales, lookup, left, right):
    review = inspect(sales, lookup, left, right)
    if not review["safe"]:
        raise ValueError(
            "The lookup needs unique, complete keys and at least one matching sales row."
        )
    # Only add new attributes. The original measure and transaction count stay intact.
    extra = (
        lookup.drop(columns=right).loc[:, lambda table: ~table.columns.isin(sales.columns)].copy()
    )
    if extra.empty:
        raise ValueError("This lookup adds no new columns.")
    extra.index = keys(lookup[right])
    return sales.join(extra.reindex(keys(sales[left])).set_axis(sales.index))
