from app.evaluation import retrieval_metrics


def test_retrieval_metrics_rank_relevant_sources():
    result = retrieval_metrics(["a", "x", "b"], {"a", "b"}, k=3)
    assert result["precision_at_k"] == 0.6667
    assert result["recall_at_k"] == 1.0
    assert result["reciprocal_rank"] == 1.0


def test_retrieval_metrics_miss():
    result = retrieval_metrics(["x", "y"], {"a"}, k=2)
    assert result["precision_at_k"] == 0.0
    assert result["recall_at_k"] == 0.0
