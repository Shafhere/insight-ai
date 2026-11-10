# INSIGHT AI — Which file should I open?

Open this alongside VS Code. A **route** receives a browser request. A **service/engine** does the real work. A **schema** checks input/output types. That is the main pattern.

| User action | API file | Code doing the work |
|---|---|---|
| Login / viewer signup | `app/api/portal.py` | `app/auth/store.py` |
| Upload a file | `app/api/datasets.py` | `app/data/dataset_service.py`, `ingestion.py` |
| Describe the dataset (EDA) | `app/api/datasets.py` | `app/data/profiling.py`, `schema_detection.py`, `domain_detection.py` |
| Preview and approve cleaning | `app/api/cleaning.py` | `app/cleaning/pipeline.py` |
| Calculate KPIs, trends, groups | `app/api/analytics.py` | `app/analytics/service.py`, `query_service.py` |
| Ask AI Analyst | `app/api/analyst.py` | `app/agents/workflow.py`, `agent_01…04` |
| Build/retrieve RAG knowledge | `app/api/rag.py` | `app/rag/retrieval.py`, optionally `tasks.py` |
| Train/evaluate predictive model | `app/api/predictive.py` | `app/prediction/model_engine.py`, `service.py` |
| Forecast monthly/segment values | `app/api/forecasting.py` | `app/prediction/forecasting.py` |
| Create business recommendations | `app/api/decision.py` | `app/decision/service.py`, `engine.py` |
| Publish report / viewer chat | `app/api/portal.py` | `app/auth/store.py`, published report snapshot |

All paths above are under **`backend/`**. The application starts at `backend/app/main.py`.

## The four agents in order

| File | What it does |
|---|---|
| `app/agents/agent_01_data_profile.py` | Uses saved dataset schema to plan the question |
| `app/agents/agent_02_analytics.py` | Runs calculated Pandas analytics when needed |
| `app/agents/agent_03_knowledge_retrieval.py` | Retrieves relevant metadata from the RAG index when needed |
| `app/agents/agent_04_insight_reporting.py` | Explains computed and retrieved evidence to the user |
| `app/agents/workflow.py` | Connects agents as a **conditional LangGraph graph** and logs which executed |

A question does **not** always need all four nodes. Cleaning is a normal data-service pipeline, **not** a fifth conversational agent. Viewer chat is handled separately using its **published report snapshot**.

## Frontend navigation

Frontend is React, **not Vue**. To keep the existing dashboard behavior stable, the screen components remain inside `frontend/src/App.jsx`. Use VS Code `Ctrl+F` to jump directly to these function names:

- `App` — top-level state, admin/viewer selection, theme and navigation.
- `AuthPage` — login and signup screens.
- `ViewerPortal` — authorized viewer dashboard/report/chat.
- `OverviewPage` — primary business dashboard.
- `DataUnderstandingPage` — Data Sources and column details.
- `DataHealthPage` — data-quality overview.
- `CleaningPage` — preview/review/apply cleaning.
- `AnalyticsPage` — charts and business analysis.
- `AIAssistantPage` — four-agent AI analyst UI.
- `PredictivePage` and `ForecastPage` — ML and forecasts.
- `ReportsPage` — four-part report and publication.

`frontend/src/services/api.js` contains the browser's calls to FastAPI. `frontend/src/App.css` contains shared theme/layout styles. The single-file frontend is a **known maintainability limitation**, not a new complex folder hierarchy.

## Where are the data files?

Local runtime data goes into `backend/storage/<dataset-id>/`, including the original upload, `profile.json`, and after approval `cleaned.csv` and `cleaning_report.json`. This folder is git-ignored and **not shipped** with the ZIP. Chroma vector indexes and a local SQLite portal database are also runtime-only. `backend/app/config.py` controls storage location.

## What to read next

Open `INTERVIEW_FLOW.md` for the human story and function sequence, then `EVALUATION.md` for justifying each technology and explaining the measured vs unmeasured performance.
