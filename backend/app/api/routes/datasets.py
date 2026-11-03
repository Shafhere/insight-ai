from fastapi import APIRouter, File, HTTPException, UploadFile

from app.modules.understanding.loader import DatasetLoadError
from app.schemas.dataset import (
    DatasetProfile,
    DatasetUploadResponse,
)
from app.services.dataset_service import (
    DatasetServiceError,
    analyse_saved_dataset,
    get_dataset_profile,
    save_upload,
)
from app.services.data_query_service import get_dataset_rows

router = APIRouter(
    prefix="/datasets",
    tags=["Datasets"],
)


@router.post(
    "/upload",
    response_model=DatasetUploadResponse,
)
async def upload_dataset(
    file: UploadFile = File(...),
):
    original_filename = file.filename or "dataset"

    try:
        file_path, dataset_id = await save_upload(file)

        profile = analyse_saved_dataset(
            file_path=file_path,
            dataset_id=dataset_id,
            original_filename=original_filename,
        )

        return DatasetUploadResponse(
            message="Dataset uploaded and profiled successfully.",
            dataset=profile,
        )

    except DatasetServiceError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except DatasetLoadError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while processing the dataset.",
        ) from exc


@router.get(
    "/{dataset_id}/profile",
    response_model=DatasetProfile,
)
def get_profile(dataset_id: str):
    try:
        return get_dataset_profile(dataset_id)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except DatasetServiceError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

@router.get("/{dataset_id}/rows")
def get_dataset_rows_endpoint(
    dataset_id: str,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
):
    try:
        return get_dataset_rows(dataset_id, page, page_size, search)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
