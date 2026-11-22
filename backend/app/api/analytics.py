
from fastapi import APIRouter, HTTPException, Query

from app.schemas.analytics import (
    AnalyticsOverview,
    BreakdownResponse,
    CorrelationResponse,
    TrendResponse,
)
from app.analytics.service import (
    AnalyticsServiceError,
    calculate_breakdown,
    calculate_correlations,
    calculate_overview,
    calculate_trend,
)

# These routes return verified numbers and chart data from the chosen dataset source.
router = APIRouter(prefix="/datasets", tags=["Analytics"])


@router.get(
    "/{dataset_id}/analytics/overview",
    response_model=AnalyticsOverview,
)
def get_analytics_overview(
    dataset_id: str,
    source: str = Query(default="original"),
):
    try:
        return calculate_overview(dataset_id, source)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{dataset_id}/analytics/breakdown",
    response_model=BreakdownResponse,
)
def get_analytics_breakdown(
    dataset_id: str,
    group_by: str,
    metric: str | None = None,
    aggregation: str = "sum",
    source: str = Query(default="original"),
):
    try:
        return calculate_breakdown(
            dataset_id,
            group_by,
            metric,
            aggregation,
            source,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{dataset_id}/analytics/trend",
    response_model=TrendResponse,
)
def get_analytics_trend(
    dataset_id: str,
    date_column: str,
    metric: str,
    frequency: str = "month",
    source: str = Query(default="original"),
):
    try:
        return calculate_trend(
            dataset_id,
            date_column,
            metric,
            frequency,
            source,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{dataset_id}/analytics/correlations",
    response_model=CorrelationResponse,
)
def get_analytics_correlations(
    dataset_id: str,
    source: str = Query(default="original"),
):
    try:
        return calculate_correlations(dataset_id, source)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
