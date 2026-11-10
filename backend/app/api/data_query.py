
from fastapi import APIRouter, HTTPException

from app.schemas.data_query import DataQueryRequest
from app.analytics.query_service import (
    aggregate_column,
    get_dataset_overview,
    get_distinct_values,
    group_by_column,
)

router = APIRouter(
    prefix="/datasets",
    tags=["Full Dataset Query Engine"],
)


@router.post("/{dataset_id}/query")
def query_dataset(
    dataset_id: str,
    request: DataQueryRequest,
):
    """Execute a query against the complete original dataset."""

    try:
        if request.operation == "overview":
            return get_dataset_overview(dataset_id)

        if request.operation == "aggregate":
            return aggregate_column(
                dataset_id=dataset_id,
                column=request.column,
                aggregation=request.aggregation,
            )

        if request.operation == "distinct":
            return get_distinct_values(
                dataset_id=dataset_id,
                column=request.column,
                limit=request.limit,
            )

        if request.operation == "group_by":
            return group_by_column(
                dataset_id=dataset_id,
                group_by=request.group_by,
                aggregation=request.aggregation,
                metric=request.metric,
                limit=request.limit,
            )

        raise ValueError("Unsupported query operation.")

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset query failed: {exc}",
        ) from exc
