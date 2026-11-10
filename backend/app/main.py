
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse

from app.api.analyst import router as analyst_router
from app.api.analytics import router as analytics_router
from app.api.cleaning import router as cleaning_router
from app.api.data_query import router as data_query_router
from app.api.datasets import router as datasets_router
from app.api.decision import router as decision_router
from app.api.predictive import router as predictive_router
from app.api.forecasting import router as forecasting_router
from app.api.rag import router as rag_router
from app.api.portal import router as portal_router
from app.auth.store import authenticate_request
from app.config import settings

# STEP 1: The browser sends an API request here; FastAPI routes it to api/*.py.
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
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "application": settings.app_name,
        "version": "0.2.0",
    }


# STEP 2: Every protected request is checked for an admin or viewer role.
@app.middleware("http")
async def portal_access_control(request: Request, call_next):
    path = request.url.path
    open_paths = {
        "/health",
        f"{settings.api_prefix}/auth/admin-login",
        f"{settings.api_prefix}/auth/viewer-signup",
        f"{settings.api_prefix}/auth/viewer-login",
    }
    if request.method == "OPTIONS" or path in open_paths or path.startswith("/docs") or path.startswith("/openapi"):
        return await call_next(request)
    if path == f"{settings.api_prefix}/auth/me":
        try:
            authenticate_request(request)
        except Exception as exc:
            status = getattr(exc, "status_code", 401)
            detail = getattr(exc, "detail", "Please sign in.")
            return JSONResponse(status_code=status, content={"detail": detail})
    elif path.startswith(f"{settings.api_prefix}/viewer/"):
        try:
            authenticate_request(request, ("viewer",))
        except Exception as exc:
            status = getattr(exc, "status_code", 401)
            detail = getattr(exc, "detail", "Viewer access required.")
            return JSONResponse(status_code=status, content={"detail": detail})
    else:
        try:
            authenticate_request(request, ("admin",))
        except Exception as exc:
            status = getattr(exc, "status_code", 401)
            detail = getattr(exc, "detail", "Administrator access required.")
            return JSONResponse(status_code=status, content={"detail": detail})
    return await call_next(request)


# STEP 3: API routes call the data, cleaning, analytics, AI and report services.
# Keep each feature in its own small api/*.py file.
app.include_router(datasets_router, prefix=settings.api_prefix)
app.include_router(cleaning_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(rag_router, prefix=settings.api_prefix)
app.include_router(data_query_router, prefix=settings.api_prefix)
app.include_router(analyst_router, prefix=settings.api_prefix)
app.include_router(decision_router, prefix=settings.api_prefix)
app.include_router(predictive_router, prefix=settings.api_prefix)
app.include_router(forecasting_router, prefix=settings.api_prefix)
app.include_router(portal_router, prefix=settings.api_prefix)