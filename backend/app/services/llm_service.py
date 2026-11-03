
"""
INSIGHT AI - LLM Service

Responsibilities:
1. Connect to Groq using LangChain.
2. Initialize the configured language model.
3. Send prompts to the model.
4. Return the generated response.
"""

from functools import lru_cache

from langchain_groq import ChatGroq

from app.config import settings


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    """
    Create and cache one Groq LLM instance.

    Caching avoids creating a new model client
    every time an API request arrives.
    """

    if not settings.groq_api_key:
        raise ValueError(
            "GROQ_API_KEY is missing. "
            "Please configure it in backend/.env"
        )

    if settings.llm_provider.lower() != "groq":
        raise ValueError(
            f"Unsupported LLM provider: {settings.llm_provider}"
        )

    return ChatGroq(
        model=settings.groq_model,
        api_key=settings.groq_api_key,
        temperature=0.2,
    )


def generate_response(prompt: str) -> str:
    """
    Send a prompt to Groq and return the response.
    """

    llm = get_llm()

    response = llm.invoke(prompt)

    return response.content
