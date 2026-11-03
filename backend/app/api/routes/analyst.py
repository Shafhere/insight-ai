
from fastapi import APIRouter, HTTPException

from app.modules.analyst.graph import run_ai_analyst
from app.schemas.analyst import AnalystQuestionRequest

router = APIRouter(
    prefix="/datasets",
    tags=["AI Analyst - LangGraph"],
)


@router.post("/{dataset_id}/analyst/ask")
def ask_ai_analyst(
    dataset_id: str,
    request: AnalystQuestionRequest,
):
    """Ask a natural-language question about an uploaded dataset."""

    try:
        return run_ai_analyst(
            dataset_id=dataset_id,
            question=request.question,
        )

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
            detail=f"AI Analyst failed: {exc}",
        ) from exc
