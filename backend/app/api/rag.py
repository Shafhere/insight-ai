
from fastapi import APIRouter, HTTPException

from app.schemas.rag import (
    RAGAnswerResponse,
    RAGIndexResponse,
    RAGQuestionRequest,
)
from app.rag.retrieval import (
    ask_dataset_question,
    index_dataset,
)

from app.rag.celery_app import celery_app
from app.rag.tasks import index_dataset_background

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


@router.post("/{dataset_id}/rag/index-async")
def queue_dataset_index(dataset_id: str):
    """Queue the CPU/memory-intensive embedding job in the worker process."""
    try:
        task = index_dataset_background.delay(dataset_id)
        return {"job_id": task.id, "status": "queued"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Background worker is unavailable. Start the INSIGHT AI worker and Redis service.") from exc


@router.get("/{dataset_id}/rag/jobs/{job_id}")
def dataset_index_job_status(dataset_id: str, job_id: str):
    result = celery_app.AsyncResult(job_id)
    if result.state == "PENDING":
        return {"job_id": job_id, "status": "queued"}
    if result.state == "STARTED":
        return {"job_id": job_id, "status": "running"}
    if result.state == "FAILURE":
        return {"job_id": job_id, "status": "failed", "error": str(result.result)}
    if result.state == "SUCCESS":
        return {"job_id": job_id, "status": "completed", "result": result.result}
    return {"job_id": job_id, "status": result.state.lower()}


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
