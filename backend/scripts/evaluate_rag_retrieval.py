"""Run a labelled RAG retrieval benchmark on an existing indexed dataset.

Usage (from backend, after installing requirements and indexing dataset):
 python scripts/evaluate_rag_retrieval.py --dataset-id UUID --cases scripts/rag_benchmark_template.jsonl

Ground truth source ids: dataset_overview, data_quality, column_profile:<exact_column>.
Requires actual ChromaDB embeddings; metrics are not simulated.
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.evaluation import retrieval_metrics


def source_id(document) -> str:
    metadata = document.metadata
    doc_type = metadata.get('document_type', 'unknown')
    if doc_type == 'column_profile':
        return f"column_profile:{metadata.get('column_name', '<unknown>')}"
    return str(doc_type)


def evaluate(dataset_id: str, cases: Path, k: int) -> dict:
    # Delayed import keeps this script discoverable when optional AI libs are absent.
    from app.rag.retrieval import retrieve_documents

    observations = []
    for line_number, line in enumerate(cases.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        case = json.loads(line)
        relevant = set(case.get('relevant_source_ids', []))
        if not relevant:
            raise ValueError(f'Case {line_number} needs non-empty relevant_source_ids (human annotated).')
        start = time.perf_counter()
        results = retrieve_documents(dataset_id, case['question'], k=k)
        elapsed = (time.perf_counter() - start) * 1000
        retrieved_ids = [source_id(doc) for doc in results]
        metrics = retrieval_metrics(retrieved_ids, relevant, k=k)
        observations.append({
            'question': case['question'], 'expected': sorted(relevant),
            'retrieved': retrieved_ids, 'latency_ms': round(elapsed, 1),
            **metrics, 'hit_at_k': bool(metrics['relevant_retrieved']),
        })
    if not observations:
        raise ValueError('No benchmark questions were supplied.')
    averages = {
        'case_count': len(observations),
        'precision_at_k': round(sum(x['precision_at_k'] for x in observations) / len(observations), 4),
        'recall_at_k': round(sum(x['recall_at_k'] for x in observations) / len(observations), 4),
        'mrr_at_k': round(sum(x['reciprocal_rank'] for x in observations) / len(observations), 4),
        'hit_rate_at_k': round(sum(x['hit_at_k'] for x in observations) / len(observations), 4),
        'mean_latency_ms': round(sum(x['latency_ms'] for x in observations) / len(observations), 1),
    }
    return {'dataset_id': dataset_id, 'k': k, 'summary': averages, 'cases': observations,
            'caution': 'This evaluates retrieval only, NOT final-answer factual correctness or agent success.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset-id', required=True)
    parser.add_argument('--cases', default='scripts/rag_benchmark_template.jsonl', type=Path)
    parser.add_argument('--k', type=int, default=5)
    parser.add_argument('--output', type=Path, default=Path('rag_evaluation_result.json'))
    args = parser.parse_args()
    if args.k < 1:
        parser.error('--k must be >= 1')
    report = evaluate(args.dataset_id, args.cases, args.k)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report['summary'], indent=2))
    print('Saved:', args.output)


if __name__ == '__main__':
    main()
