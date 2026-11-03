
from fastapi import APIRouter, HTTPException

from app.schemas.rag import (
    RAGAnswerResponse,
    RAGIndexResponse,
    RAGQuestionRequest,
)
from app.services.rag_service import (
    ask_dataset_question,
    index_dataset,
)

router = APIRouter(
    prefix="/datasets",
    tags=["RAG - AI Analyst"],
)


@router.post(
    "/{dataset_id}/rag/index",
    response_model=RAGIndexResponse,
)
def create_dataset_knowledge_base(dataset_id: str):
    """
    Build or rebuild the dataset's vector knowledge base.
    """

    try:
        return index_dataset(dataset_id)

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
            detail=f"Unable to index dataset: {str(exc)}",
        ) from exc


@router.post(
    "/{dataset_id}/rag/ask",
    response_model=RAGAnswerResponse,
)
def ask_dataset(
    dataset_id: str,
    request: RAGQuestionRequest,
):
    """
    Retrieve dataset knowledge and generate an AI answer.
    """

    try:
        return ask_dataset_question(
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
            detail=f"Unable to answer question: {str(exc)}",
        ) from exc
