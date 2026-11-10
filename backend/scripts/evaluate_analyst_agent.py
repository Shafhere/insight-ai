"""Run a labelled, reproducible smoke benchmark of the real LangGraph analyst.

Requires backend dependencies, GROQ_API_KEY for LLM-based prompts, and an existing
uploaded/indexed dataset. Reports mechanical task success only; human review of
factuality, grounding and usefulness is mandatory.

python scripts/evaluate_analyst_agent.py --dataset-id UUID --cases scripts/analyst_benchmark_template.jsonl
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def evaluate(dataset_id: str, cases_path: Path):
    from app.agents.workflow import run_ai_analyst
    rows=[]
    for i, line in enumerate(cases_path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip(): continue
        case=json.loads(line)
        question=case['question']
        try:
            answer=run_ai_analyst(dataset_id, question)
            trace=[step.get('node') for step in answer.get('execution_trace', [])]
            errors=answer.get('errors', [])
            text=str(answer.get('answer') or '')
            expected_nodes=case.get('expected_nodes', [])
            tokens=case.get('expected_answer_contains', [])
            row={'case':i, 'question':question, 'success_no_exception':True,
                 'nodes_executed':trace,'expected_nodes_executed': all(x in trace for x in expected_nodes),
                 'answer_nonempty':bool(text.strip()),
                 'required_text_found': all(str(x).casefold() in text.casefold() for x in tokens),
                 'error_count':len(errors),
                 'analytics_failed':bool(answer.get('analytics_failed')),
                 'rag_failed':bool(answer.get('rag_failed')),
                 'seconds':answer.get('total_elapsed_seconds'),
                 'answer':text,'errors':errors,
                 'human_factuality_score': None,'human_faithfulness_score':None,
                 'human_usefulness_score':None}
        except Exception as exc:
            row={'case':i,'question':question,'success_no_exception':False,
                 'exception':str(exc),'human_factuality_score':None,
                 'human_faithfulness_score':None,'human_usefulness_score':None}
        rows.append(row)
    if not rows: raise ValueError('The benchmark needs at least one question.')
    def rate(field):
        return round(sum(bool(x.get(field)) for x in rows)/len(rows),4)
    return {'dataset_id':dataset_id,'summary':{'cases':len(rows),
            'run_success_rate':rate('success_no_exception'),
            'nonempty_answer_rate':rate('answer_nonempty'),
            'expected_nodes_rate':rate('expected_nodes_executed'),
            'required_text_match_rate':rate('required_text_found')},
            'cases':rows, 'limitations':[
                'Matching requested words does not guarantee a factually accurate answer.',
                'Manual evidence-grounding and business-usefulness scoring are NOT calculated by this script.',
                'A workflow might correctly skip an agent that is not needed for the question.',
            ]}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset-id',required=True)
    parser.add_argument('--cases',type=Path,default=Path('scripts/analyst_benchmark_template.jsonl'))
    parser.add_argument('--output',type=Path,default=Path('analyst_agent_evaluation_result.json'))
    args=parser.parse_args()
    result=evaluate(args.dataset_id,args.cases)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result['summary'],indent=2))
    print('Saved:',args.output)

if __name__ == '__main__': main()
