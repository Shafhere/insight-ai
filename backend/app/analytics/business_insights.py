"""Deterministic historical business intelligence derived from uploaded data."""
from typing import Any
import pandas as pd
from app.analytics.service import load_analytics_dataset, get_semantic_columns, prepare_business_dataframe, safe_number

def build_business_context(dataset_id: str, source: str = "original") -> dict[str, Any]:
    raw = load_analytics_dataset(dataset_id, source)
    semantics = get_semantic_columns(dataset_id)
    df = prepare_business_dataframe(raw, semantics)
    context: dict[str, Any] = {"rows": len(df), "columns": len(raw.columns), "business_metrics_available": [], "observations": [], "limitations": []}
    revenue = "__insight_revenue__" if "__insight_revenue__" in df else next((c for c in df.columns if semantics.get(c) == "revenue" and pd.api.types.is_numeric_dtype(df[c])), None)
    qty = next((c for c in df.columns if semantics.get(c) == "quantity" and pd.api.types.is_numeric_dtype(df[c])), None)
    date = next((c for c in df.columns if semantics.get(c) == "date"), None)
    category = next((c for c in df.columns if semantics.get(c) == "category"), None)
    product = next((c for c in df.columns if semantics.get(c) == "product"), None)
    location = next((c for c in df.columns if semantics.get(c) == "location"), None)
    margin = next((c for c in df.columns if "margin" in c.lower() and pd.api.types.is_numeric_dtype(df[c])), None)
    if revenue:
        total = pd.to_numeric(df[revenue], errors="coerce").sum(min_count=1)
        context["total_revenue"] = safe_number(total)
        context["revenue_column"] = "derived price × quantity" if revenue == "__insight_revenue__" else revenue
        context["business_metrics_available"].append("revenue")
    else:
        context["limitations"].append("Revenue cannot be calculated: no usable revenue column or compatible price and quantity pair was found.")
    if qty:
        context["total_quantity"] = safe_number(pd.to_numeric(df[qty], errors="coerce").sum(min_count=1))
        context["quantity_column"] = qty
        context["business_metrics_available"].append("quantity")
    if date:
        dates = pd.to_datetime(df[date], errors="coerce")
        valid = dates.notna()
        if valid.any():
            context["date_range"] = {"start": dates[valid].min().strftime("%Y-%m-%d"), "end": dates[valid].max().strftime("%Y-%m-%d")}
            context["business_metrics_available"].append("time series")
            if revenue:
                trend_df = pd.DataFrame({"period": dates[valid].dt.to_period("M").astype(str), "value": pd.to_numeric(df.loc[valid, revenue], errors="coerce")})
                monthly = trend_df.groupby("period")["value"].sum().sort_index()
                context["monthly_revenue"] = [{"month": str(k), "revenue": safe_number(v)} for k, v in monthly.items()]
                if len(monthly) >= 2:
                    previous, latest = float(monthly.iloc[-2]), float(monthly.iloc[-1])
                    change = ((latest - previous) / abs(previous) * 100) if previous else None
                    context["latest_month_comparison"] = {"previous_month": str(monthly.index[-2]), "latest_month": str(monthly.index[-1]), "previous_revenue": safe_number(previous), "latest_revenue": safe_number(latest), "change_percent": safe_number(change)}
            if qty:
                trend_qty = pd.DataFrame({"period": dates[valid].dt.to_period("M").astype(str), "value": pd.to_numeric(df.loc[valid, qty], errors="coerce")})
                monthly_qty = trend_qty.groupby("period")["value"].sum().sort_index()
                context["monthly_quantity"] = [{"month": str(k), "quantity": safe_number(v)} for k, v in monthly_qty.items()]
                if len(monthly_qty) >= 2:
                    context["latest_month_quantity_comparison"] = {"previous_month": str(monthly_qty.index[-2]), "latest_month": str(monthly_qty.index[-1]), "previous_quantity": safe_number(monthly_qty.iloc[-2]), "latest_quantity": safe_number(monthly_qty.iloc[-1])}
    if category and revenue:
        grouped = df.groupby(category, dropna=False)[revenue].sum(min_count=1).dropna().sort_values(ascending=False)
        context["category_revenue"] = [{"category": str(k), "revenue": safe_number(v)} for k, v in grouped.head(10).items()]
        if len(grouped):
            context["observations"].append(f"Highest recorded revenue category: {grouped.index[0]} ({safe_number(grouped.iloc[0])}).")
            context["observations"].append(f"Lowest recorded revenue category: {grouped.index[-1]} ({safe_number(grouped.iloc[-1])}).")
    if product and revenue:
        grouped = df.groupby(product, dropna=False)[revenue].sum(min_count=1).dropna().sort_values(ascending=False)
        context["product_revenue"] = [{"product": str(k), "revenue": safe_number(v)} for k, v in grouped.head(10).items()]
        context["lowest_product_revenue"] = [{"product": str(k), "revenue": safe_number(v)} for k, v in grouped.tail(5).sort_values().items()]
        if len(grouped):
            context["observations"].append(f"Highest recorded revenue product: {grouped.index[0]} ({safe_number(grouped.iloc[0])}).")
    if product and qty:
        grouped_qty = df.groupby(product, dropna=False)[qty].sum(min_count=1).dropna().sort_values(ascending=False)
        context["product_quantity"] = [{"product": str(k), "quantity": safe_number(v)} for k, v in grouped_qty.head(10).items()]
        context["lowest_product_quantity"] = [{"product": str(k), "quantity": safe_number(v)} for k, v in grouped_qty.tail(5).sort_values().items()]
    elif not product:
        context["limitations"].append("No product-name field was identified, so product-level rankings and product-specific stock recommendations are unavailable.")
    if category and qty:
        grouped_qty = df.groupby(category, dropna=False)[qty].sum(min_count=1).dropna().sort_values(ascending=False)
        context["category_quantity"] = [{"category": str(k), "quantity": safe_number(v)} for k, v in grouped_qty.items()]
    if location and revenue:
        grouped_location = df.groupby(location, dropna=False)[revenue].sum(min_count=1).dropna().sort_values(ascending=False)
        context["location_revenue"] = [{"location": str(k), "revenue": safe_number(v)} for k, v in grouped_location.head(10).items()]
        context["lowest_location_revenue"] = [{"location": str(k), "revenue": safe_number(v)} for k, v in grouped_location.tail(5).sort_values().items()]
    if margin:
        context["average_profit_margin"] = safe_number(pd.to_numeric(df[margin], errors="coerce").mean())
        context["profit_margin_column"] = margin
    if not category:
        context["limitations"].append("No category field was identified, so category comparisons are unavailable.")
    if not date:
        context["limitations"].append("No date/time field was identified, so monthly or weekly sales trends cannot be calculated.")
    context["data_quality"] = {"missing_cells": int(raw.isna().sum().sum()), "duplicate_rows": int(raw.duplicated().sum())}
    return context
