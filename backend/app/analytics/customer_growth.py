"""Summaries use only purchases observed by the last date in this dataset."""

import pandas as pd
from app.data.modeling import normalized


def field(df, *names):
    columns = {normalized(c): c for c in df}
    return next((columns[normalized(n)] for n in names if normalized(n) in columns), None)


def fields(df):
    return {
        "customer": field(df, "customer_id", "customer_number", "client_id", "member_id"),
        "date": field(
            df, "order_date", "purchase_date", "bill_date", "sale_date", "transaction_date", "date"
        ),
        "value": field(
            df,
            "net_sales_inr",
            "net_sales",
            "revenue",
            "sales_amount",
            "total_amount",
            "sales",
            "amount",
        ),
        "name": field(df, "customer_name", "full_name", "name"),
        "product": field(df, "category", "product_category", "product_name", "sku"),
        "order": field(df, "order_id", "invoice_id", "bill_id", "transaction_id"),
    }


def customer_growth(df, private=False):
    f = fields(df)
    if not f["customer"] or not f["date"]:
        return {
            "reason": "Purchase history needs a customer ID and a transaction date. Upload customer transactions or join a customer directory in Data Modeling."
        }
    dates = (
        pd.to_datetime(df[f["date"]], errors="coerce", utc=True).dt.tz_convert(None).dt.normalize()
    )
    data = pd.DataFrame(
        {
            "customer": df[f["customer"]].astype("string").str.strip().replace("", pd.NA),
            "date": dates,
        }
    )
    data["order"] = df[f["order"]] if f["order"] else dates
    data["value"] = pd.to_numeric(df[f["value"]], errors="coerce") if f["value"] else float("nan")
    data["name"] = df[f["name"]] if f["name"] else data.customer
    data["product"] = df[f["product"]] if f["product"] else None
    for alias, names in {
        "store": ("store_name", "store_id", "branch"),
        "occasion": ("shopping_occasion", "season"),
        "permission": ("marketing_contact_permission", "marketing_consent"),
    }.items():
        col = field(df, *names)
        data[alias] = df[col] if col else None
    data = data.dropna(subset=["date", "customer"]).sort_values("date")
    if data.empty:
        return {"reason": "No dated purchases with a customer ID were found."}
    # Walk-in purchases also establish how far the sales history extends.
    end = dates.max()
    rows = []
    for customer, g in data.groupby("customer", sort=False):
        visits = g.date.drop_duplicates()
        intervals = visits.diff().dropna().dt.days
        cadence = float(intervals.median()) if len(intervals) else None
        elapsed = (end - visits.iloc[-1]).days
        overdue = bool(cadence and elapsed > 1.5 * cadence)
        count = int(g.order.nunique())
        preferred = g["product"].dropna().mode()
        spend = g.value.sum(min_count=1)
        seasonal = []
        if g.occasion.notna().any():
            for label, occasion in g.dropna(subset=["occasion"]).groupby("occasion"):
                years = sorted(occasion.date.dt.year.unique())
                if len(years) >= 2 and label not in ("Regular", "Everyday", "Regular shopping"):
                    latest = occasion.date.max()
                    missed = latest.year < end.year and (end.month, end.day) >= (
                        latest.month,
                        latest.day,
                    )
                    seasonal.append(
                        f"{label}: {', '.join(map(str, years))}"
                        + ("; no comparable visit yet this year" if missed else "")
                    )
        annual = g.groupby(g.date.dt.year).order.nunique().to_dict()
        annual = {
            str(year): int(annual.get(year, 0)) for year in range(g.date.min().year, end.year + 1)
        }
        consent = g.permission.dropna()
        rows.append(
            dict(
                first_purchase=str(visits.iloc[0].date()),
                annual=annual,
                seasonal=seasonal,
                stores=list(map(str, g.store.dropna().unique())),
                average_order=round(float(spend) / count, 2) if count and pd.notna(spend) else None,
                permission=str(consent.iloc[-1]) if len(consent) else "Unknown",
                customer=str(customer),
                name=str(g.name.dropna().iloc[-1]) if g.name.notna().any() else str(customer),
                orders=count,
                days_since=elapsed,
                cadence_days=round(cadence) if cadence else None,
                last_purchase=str(visits.iloc[-1].date()),
                spend=None if pd.isna(spend) else round(float(spend), 2),
                interest=str(preferred.iloc[0]) if len(preferred) else None,
                segment="Overdue" if overdue else "Returning" if count > 1 else "First purchase",
                recovered=bool(
                    len(intervals) >= 3 and intervals.iloc[-1] > 1.5 * intervals.iloc[:-1].median()
                ),
            )
        )
    repeat = sum(r["orders"] > 1 for r in rows)
    overdue = sum(r["segment"] == "Overdue" for r in rows)
    result = dict(
        customers=len(rows),
        returning=repeat,
        repeat_pct=round(100 * repeat / len(rows), 1),
        overdue=overdue,
        recovered=sum(r["recovered"] for r in rows),
        as_of=str(end.date()),
        segments=pd.Series([r["segment"] for r in rows])
        .value_counts()
        .rename_axis("name")
        .reset_index(name="value")
        .to_dict("records"),
        summary=f"{repeat} of {len(rows)} observed customers purchased more than once. {overdue} exceeded their estimated return window as of {end.date()}.",
    )
    threshold = pd.Series([r["spend"] for r in rows], dtype="float").quantile(0.75)
    for row in rows:
        high = row["spend"] is not None and row["spend"] >= threshold
        row["rfm"] = (
            "Potentially inactive"
            if row["segment"] == "Overdue"
            else "High value"
            if high
            else "Loyal"
            if row["orders"] >= 3
            else "New"
            if row["orders"] == 1
            else "Occasional"
        )
    result["order_basis"] = f["order"] or "distinct shopping dates (order ID unavailable)"
    result["rfm_segments"] = pd.Series([r["rfm"] for r in rows]).value_counts().to_dict()
    result["identified_lines"] = len(data)
    result["source_lines"] = len(df)
    result["excluded_lines"] = len(df) - len(data)
    if private:
        result["rows"] = sorted(
            rows, key=lambda r: (r["segment"] == "Overdue", r["spend"] or 0), reverse=True
        )
    return result
