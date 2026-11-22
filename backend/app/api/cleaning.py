
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.schemas.cleaning import (
    CleaningApplyRequest,
    CleaningApplyResponse,
    CleaningPreviewResponse,
)
from app.cleaning import (
    CleaningServiceError,
    get_original_file,
    preview_cleaning,
    run_cleaning,
)

router = APIRouter(prefix="/datasets", tags=["Data Preparation"])


@router.get(
    "/{dataset_id}/cleaning/preview",
    response_model=CleaningPreviewResponse,
)
def get_cleaning_preview(dataset_id: str):
    try:
        return preview_cleaning(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CleaningServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{dataset_id}/cleaning/apply",
    response_model=CleaningApplyResponse,
)
def apply_dataset_cleaning(
    dataset_id: str,
    request: CleaningApplyRequest,
):
    try:
        return run_cleaning(dataset_id, request)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CleaningServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during data cleaning.",
        ) from exc


@router.get("/{dataset_id}/cleaning/download")
def download_cleaned_dataset(dataset_id: str):
    try:
        original_file = get_original_file(dataset_id)
        cleaned_file = original_file.parent / "cleaned.csv"

        if not cleaned_file.is_file():
            raise FileNotFoundError(
                "No cleaned dataset exists. Apply cleaning first."
            )

        return FileResponse(
            path=cleaned_file,
            media_type="text/csv",
            filename=f"{dataset_id}_cleaned.csv",
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CleaningServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
