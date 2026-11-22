from app.rag.celery_app import celery_app


@celery_app.task(name="insight.index_dataset")
def index_dataset_background(dataset_id: str):
    from app.rag.retrieval import index_dataset
    result = index_dataset(dataset_id)
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")
    return result
