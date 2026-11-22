"""Agent 3: retrieve dataset knowledge through the RAG vector index."""


def run(state: dict) -> dict:
    from app.agents.workflow import retrieve_rag_context

    return retrieve_rag_context(state)
