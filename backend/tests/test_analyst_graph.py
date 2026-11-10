import pytest

from app.agents import workflow as graph
from app.agents.workflow import extract_json
from app.schemas.analyst import AnalystPlan


def test_question_routes_to_analytics():
    state = {
        "plan": {
            "needs_analytics": True,
            "needs_rag": False,
        }
    }

    assert graph.choose_after_planning(state) == "analytics"


def test_question_routes_to_rag():
    state = {
        "plan": {
            "needs_analytics": False,
            "needs_rag": True,
        }
    }

    assert graph.choose_after_planning(state) == "rag"


def test_question_routes_to_both():
    state = {
        "plan": {
            "needs_analytics": True,
            "needs_rag": True,
        }
    }

    assert graph.choose_after_planning(state) == "analytics"


def test_question_with_no_tools_routes_to_answer():
    state = {
        "plan": {
            "needs_analytics": False,
            "needs_rag": False,
        }
    }

    assert graph.choose_after_planning(state) == "answer"


def test_analytics_routes_to_rag_when_both_are_required():
    state = {
        "plan": {
            "needs_rag": True,
        }
    }

    assert graph.choose_after_analytics(state) == "rag"


def test_analytics_routes_to_answer_when_rag_is_not_required():
    state = {
        "plan": {
            "needs_rag": False,
        }
    }

    assert graph.choose_after_analytics(state) == "answer"


def test_analytics_node_executes_selected_operation(monkeypatch):
    expected_result = {
        "column": "revenue",
        "aggregation": "sum",
        "result": 99500,
    }

    def fake_aggregate_column(**kwargs):
        assert kwargs["dataset_id"] == "test-id"
        assert kwargs["column"] == "revenue"
        assert kwargs["aggregation"] == "sum"
        return expected_result

    monkeypatch.setattr(
        graph,
        "aggregate_column",
        fake_aggregate_column,
    )

    state = {
        "dataset_id": "test-id",
        "plan": {
            "operation": "aggregate",
            "column": "revenue",
            "aggregation": "sum",
        },
    }

    result = graph.run_analytics(state)

    assert result["analytics_result"] == expected_result


def test_extract_json_from_plain_response():
    result = extract_json(
        '{"needs_analytics": true, "needs_rag": false}'
    )

    assert result["needs_analytics"] is True


def test_extract_json_from_markdown_code_block():
    response = """```json
    {"needs_analytics": true, "needs_rag": false}
    ```"""

    result = extract_json(response)

    assert result["needs_rag"] is False


def test_extract_json_from_text_with_extra_content():
    response = """
    Here is the selected plan:
    {"needs_analytics": true, "needs_rag": false}
    """

    result = extract_json(response)

    assert result["needs_analytics"] is True


def test_extract_json_rejects_invalid_response():
    with pytest.raises(ValueError):
        extract_json("I cannot create a valid plan.")


def test_analyst_plan_accepts_valid_aggregation():
    plan = AnalystPlan.model_validate({
        "needs_analytics": True,
        "needs_rag": False,
        "operation": "aggregate",
        "column": "revenue",
        "aggregation": "sum",
        "limit": 100,
    })

    assert plan.operation == "aggregate"
    assert plan.aggregation == "sum"


def test_analyst_plan_rejects_unsupported_aggregation():
    with pytest.raises(ValueError):
        AnalystPlan.model_validate({
            "needs_analytics": True,
            "needs_rag": False,
            "operation": "aggregate",
            "column": "revenue",
            "aggregation": "unsupported",
        })


def test_analyst_plan_rejects_missing_aggregate_column():
    with pytest.raises(ValueError):
        AnalystPlan.model_validate({
            "needs_analytics": True,
            "needs_rag": False,
            "operation": "aggregate",
            "aggregation": "sum",
        })


def test_analyst_plan_rejects_missing_grouping_metric():
    with pytest.raises(ValueError):
        AnalystPlan.model_validate({
            "needs_analytics": True,
            "needs_rag": False,
            "operation": "group_by",
            "group_by": "product",
            "aggregation": "sum",
        })


def test_analyst_plan_allows_group_count_without_metric():
    plan = AnalystPlan.model_validate({
        "needs_analytics": True,
        "needs_rag": False,
        "operation": "group_by",
        "group_by": "product",
        "aggregation": "count",
    })

    assert plan.metric is None


def test_analyst_plan_rejects_operation_when_analytics_disabled():
    with pytest.raises(ValueError):
        AnalystPlan.model_validate({
            "needs_analytics": False,
            "needs_rag": True,
            "operation": "aggregate",
            "column": "revenue",
            "aggregation": "sum",
        })
