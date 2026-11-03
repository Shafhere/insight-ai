
from pydantic import BaseModel, Field


class RAGQuestionRequest(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=2000,
        description="Question about the uploaded dataset",
    )


class RAGSource(BaseModel):
    document_type: str | None = None
    column_name: str | None = None
    source: str | None = None


class RAGIndexResponse(BaseModel):
    dataset_id: str
    collection_name: str
    documents_indexed: int
    embedding_model: str
    vector_database: str


class RAGAnswerResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    question: str
    answer: str
    sources: list[RAGSource]
    retrieved_documents: int
