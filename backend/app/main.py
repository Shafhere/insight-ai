
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.analyst import router as analyst_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.cleaning import router as cleaning_router
from app.api.routes.data_query import router as data_query_router
from app.api.routes.datasets import router as datasets_router
from app.api.routes.decision import router as decision_router
from app.api.routes.predictive import router as predictive_router
from app.api.routes.rag import router as rag_router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    description=(
        "AI-powered Data Intelligence and Decision Support Platform."
    ),
    version="0.2.0",
    debug=settings.debug,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "application": settings.app_name,
        "version": "0.2.0",
    }


# Register application API modules.
app.include_router(datasets_router, prefix=settings.api_prefix)
app.include_router(cleaning_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(rag_router, prefix=settings.api_prefix)
app.include_router(data_query_router, prefix=settings.api_prefix)
app.include_router(analyst_router, prefix=settings.api_prefix)
app.include_router(decision_router, prefix=settings.api_prefix)
app.include_router(predictive_router, prefix=settings.api_prefix)