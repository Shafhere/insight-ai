"""Agent 4: audit evidence and write the final business explanation."""


def run(state: dict) -> dict:
    from app.agents.workflow import generate_answer

    return generate_answer(state)
