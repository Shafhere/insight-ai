from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.modules.predictive.engine import PredictiveEngineError
from app.schemas.predictive import (
    PredictionRequest,
    PredictionResponse,
    PredictiveReport,
)
from app.services.predictive_service import (
    run_prediction,
    run_saved_model_prediction,
)

router = APIRouter(tags=["Predictive Intelligence"])


@router.post(
    "/datasets/{dataset_id}/predictive/train",
    response_model=PredictiveReport,
)
def train_predictive_model(
    dataset_id: str,
    target_column: str = Query(..., min_length=1),
    source: str = Query(default="original"),
    task: Literal["auto", "regression", "classification"] = Query(
        default="auto"
    ),
):
    try:
        return run_prediction(
            dataset_id=dataset_id,
            target_column=target_column,
            source=source,
            task=task,
        )

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except PredictiveEngineError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/datasets/{dataset_id}/predictive/predict",
    response_model=PredictionResponse,
)
def predict_with_saved_model(
    dataset_id: str,
    request: PredictionRequest,
):
    try:
        return run_saved_model_prediction(
            dataset_id=dataset_id,
            records=request.records,
        )

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except PredictiveEngineError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc