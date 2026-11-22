"""Small deterministic retrieval metrics for labelled RAG benchmark runs."""
from __future__ import annotations


def retrieval_metrics(retrieved_ids: list[str], relevant_ids: set[str], k: int = 5) -> dict[str, float | int]:
    if k < 1:
        raise ValueError("k must be positive")
    ranked = retrieved_ids[:k]
    hits = [index + 1 for index, item in enumerate(ranked) if item in relevant_ids]
    precision = len(hits) / k
    recall = len(hits) / len(relevant_ids) if relevant_ids else 0.0
    reciprocal_rank = 1 / hits[0] if hits else 0.0
    return {
        "k": k,
        "relevant_retrieved": len(hits),
        "precision_at_k": round(precision, 4),
        "recall_at_k": round(recall, 4),
        "reciprocal_rank": round(reciprocal_rank, 4),
    }
