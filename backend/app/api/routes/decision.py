
from fastapi import APIRouter, HTTPException, Query

from app.schemas.decision import DecisionReport
from app.services.decision_service import generate_decision_report

router = APIRouter(tags=["Decision Intelligence"])


@router.get(
    "/datasets/{dataset_id}/decision/report",
    response_model=DecisionReport,
)
def get_decision_report(
    dataset_id: str,
    source: str = Query(default="original"),
):
    try:
        return generate_decision_report(dataset_id, source)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="Dataset or required file was not found.",
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the decision report.",
        ) from exc
