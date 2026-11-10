"""Agent 2: execute verified analytics using Python and Pandas."""


def run(state: dict) -> dict:
    from app.agents.workflow import run_analytics

    return run_analytics(state)
