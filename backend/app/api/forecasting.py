from fastapi import APIRouter, HTTPException, Query
from app.schemas.forecasting import ForecastRequest
from app.analytics.service import load_analytics_dataset, prepare_business_dataframe, get_semantic_columns
from app.prediction.forecasting import ForecastingError, forecast_series, forecast_segments

router = APIRouter(prefix="/datasets", tags=["Forecasting & Inventory"])


@router.post("/{dataset_id}/forecast")
def create_forecast(dataset_id: str, request: ForecastRequest):
    try:
        request_data = request.model_dump()
        source = request_data.pop("source", "original")
        raw_dataframe = load_analytics_dataset(dataset_id, source)
        dataframe = prepare_business_dataframe(raw_dataframe, get_semantic_columns(dataset_id))
        return forecast_series(dataframe, **request_data, allow_returns=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForecastingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{dataset_id}/forecast/segments")
def create_segment_forecasts(
    dataset_id: str,
    date_column: str = Query(min_length=1, max_length=120),
    value_column: str = Query(min_length=1, max_length=120),
    group_column: str = Query(min_length=1, max_length=120),
    source: str = "original", horizon: int = Query(default=3, ge=1, le=12),
    limit: int = Query(default=5, ge=1, le=10),
):
    try:
        dataframe = prepare_business_dataframe(load_analytics_dataset(dataset_id, source), get_semantic_columns(dataset_id))
        return forecast_segments(dataframe, date_column, value_column, group_column, horizon, limit)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForecastingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
