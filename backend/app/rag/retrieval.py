
"""
INSIGHT AI - RAG Service

Responsibilities:
1. Read an uploaded dataset and its profile.
2. Convert dataset knowledge into documents.
3. Generate local semantic embeddings.
4. Store documents in a persistent ChromaDB collection.
5. Retrieve relevant documents for a user question.
6. Generate an evidence-grounded answer using Groq.
"""

import json
import re
from functools import lru_cache

from chromadb import PersistentClient
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from sentence_transformers import SentenceTransformer

from app.config import settings
from app.data.dataset_service import get_dataset_profile
from app.shared.llm_service import get_llm

# All vector collections are stored separately from original datasets.
CHROMA_DIR = settings.storage_dir / "chroma_db"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load the local embedding model only once."""
    return SentenceTransformer(EMBEDDING_MODEL)


class LocalEmbeddings(Embeddings):
    """
    LangChain-compatible wrapper around Sentence Transformers.

    Converts text into 384-dimensional numerical vectors.
    """

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        model = get_embedding_model()

        vectors = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        return vectors.tolist()

    def embed_query(self, text: str) -> list[float]:
        model = get_embedding_model()

        vector = model.encode(
            text,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        return vector.tolist()


@lru_cache(maxsize=1)
def get_embeddings():
    """Reuse one embedding interface throughout the application."""
    return LocalEmbeddings()


def get_collection_name(dataset_id: str) -> str:
    """
    Generate a separate ChromaDB collection for each dataset.
    """
    safe_id = re.sub(r"[^a-zA-Z0-9]", "", dataset_id)

    return f"dataset_{safe_id}"


# RAG stores descriptions of the dataset and columns, not every raw transaction.
def build_dataset_documents(dataset_id: str) -> list[Document]:
    """
    Create searchable knowledge documents from dataset metadata.

    Each column gets its own document so retrieval can identify
    the most relevant column information.
    """

    profile = get_dataset_profile(dataset_id)

    documents = []

    # Document 1: Overall dataset information.
    overview = f"""
    Dataset name: {profile.filename}
    Dataset ID: {profile.dataset_id}
    File type: {profile.file_type}
    Business domain: {profile.detected_domain}
    Domain confidence: {profile.domain_confidence}

    Total rows: {profile.rows}
    Total columns: {profile.columns}
    Duplicate rows: {profile.duplicate_rows}
    Missing cells: {profile.missing_cells}
    Missing percentage: {profile.missing_percentage}%
    Data quality score: {profile.quality_score}%

    This dataset belongs to the {profile.detected_domain} domain.
    """

    documents.append(
        Document(
            page_content=overview,
            metadata={
                "dataset_id": dataset_id,
                "document_type": "dataset_overview",
                "source": profile.filename,
            },
        )
    )

    # Document 2: One document for every column.
    for column in profile.column_profiles:
        column_information = f"""
        Dataset: {profile.filename}
        Business domain: {profile.detected_domain}

        Column name: {column.name}
        Data type: {column.data_type}
        Semantic meaning: {column.semantic_type}

        Missing values: {column.missing_count}
        Missing percentage: {column.missing_percentage}%
        Unique values: {column.unique_count}

        Sample values:
        {json.dumps(column.sample_values, default=str)}

        Statistics:
        {json.dumps(column.statistics, default=str)}
        """

        documents.append(
            Document(
                page_content=column_information,
                metadata={
                    "dataset_id": dataset_id,
                    "document_type": "column_profile",
                    "column_name": column.name,
                    "source": profile.filename,
                },
            )
        )

    # Document 3: Data-quality warnings.
    warnings = getattr(profile, "warnings", [])

    warning_text = (
        "\n".join(str(warning) for warning in warnings)
        if warnings
        else "No data quality warnings were reported."
    )

    documents.append(
        Document(
            page_content=(
                f"Dataset: {profile.filename}\n"
                f"Data quality warnings:\n{warning_text}"
            ),
            metadata={
                "dataset_id": dataset_id,
                "document_type": "data_quality",
                "source": profile.filename,
            },
        )
    )

    return documents


def index_dataset(dataset_id: str) -> dict:
    """
    Embed and store all dataset documents in ChromaDB.

    Re-indexing replaces the previous collection for this dataset.
    Other datasets remain untouched.
    """

    documents = build_dataset_documents(dataset_id)

    if not documents:
        raise ValueError("No dataset documents were generated.")

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    collection_name = get_collection_name(dataset_id)

    # Delete only this dataset's old collection before re-indexing.
    client = PersistentClient(path=str(CHROMA_DIR))

    try:
        client.delete_collection(name=collection_name)
    except Exception:
        # Collection does not exist yet.
        pass

    Chroma.from_documents(
        documents=documents,
        embedding=get_embeddings(),
        collection_name=collection_name,
        persist_directory=str(CHROMA_DIR),
    )

    return {
        "dataset_id": dataset_id,
        "collection_name": collection_name,
        "documents_indexed": len(documents),
        "embedding_model": EMBEDDING_MODEL,
        "vector_database": "ChromaDB",
    }


# Return the closest indexed evidence; Pandas still performs numerical calculations.
def retrieve_documents(
    dataset_id: str,
    question: str,
    k: int = 5,
) -> list[Document]:
    """Retrieve the most relevant documents from this dataset only."""

    collection_name = get_collection_name(dataset_id)

    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        persist_directory=str(CHROMA_DIR),
    )

    return vector_store.similarity_search(
        query=question,
        k=k,
        filter={"dataset_id": dataset_id},
    )


def ask_dataset_question(
    dataset_id: str,
    question: str,
) -> dict:
    """
    Retrieve relevant dataset context and ask Groq to explain it.

    The model is instructed to use retrieved evidence only.
    """

    # Validate that the dataset exists.
    profile = get_dataset_profile(dataset_id)

    retrieved_documents = retrieve_documents(
        dataset_id=dataset_id,
        question=question,
        k=5,
    )

    if not retrieved_documents:
        raise ValueError(
            "No indexed knowledge found. Index the dataset first."
        )

    context_parts = []

    for index, document in enumerate(retrieved_documents, start=1):
        context_parts.append(
            f"""
            Evidence {index}
            Document type: {document.metadata.get("document_type")}
            Column: {document.metadata.get("column_name", "N/A")}

            Content:
            {document.page_content}
            """
        )

    context = "\n\n".join(context_parts)

    prompt = f"""
    You are INSIGHT AI, an intelligent data analyst.

    You are answering a question about a specific uploaded dataset.

    DATASET:
    {profile.filename}

    BUSINESS DOMAIN:
    {profile.detected_domain}

    USER QUESTION:
    {question}

    RETRIEVED DATASET EVIDENCE:
    {context}

    INSTRUCTIONS:

    1. Answer using the retrieved evidence.
    2. Never invent columns, statistics or dataset facts.
    3. If the evidence is insufficient, clearly say so.
    4. Explain technical terms in simple business language.
    5. Do not claim correlation proves causation.
    6. Distinguish profile statistics from calculations on raw rows.
    7. Recommend additional analysis when appropriate.
    8. Keep your answer structured and useful.

    INSIGHT AI RESPONSE:
    """

    response = get_llm().invoke(prompt)

    # Return evidence references so the user can inspect the context.
    sources = [
        {
            "document_type": doc.metadata.get("document_type"),
            "column_name": doc.metadata.get("column_name"),
            "source": doc.metadata.get("source"),
        }
        for doc in retrieved_documents
    ]

    return {
        "dataset_id": dataset_id,
        "dataset_name": profile.filename,
        "question": question,
        "answer": response.content,
        "sources": sources,
        "retrieved_documents": len(retrieved_documents),
    }
