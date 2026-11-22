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
| Forecast monthly/segment values | `app/api/forecasting.py` | `app/forecasting/service.py` |
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
- `components/GrowthWorkspace.jsx` — modeling, forecasting, customer intelligence, and shared viewer charts.
- `ReportsPage` — four-part report and publication.

`frontend/src/services/api.js` contains the browser's calls to FastAPI. `frontend/src/App.css` contains shared theme/layout styles.

## Where are the data files?

Local runtime data goes into `backend/storage/<dataset-id>/`, including the original upload, `profile.json`, and after approval `cleaned.csv` and `cleaning_report.json`. This folder is git-ignored and **not shipped** with the ZIP. Chroma vector indexes and a local SQLite portal database are also runtime-only. `backend/app/config.py` controls storage location.

## What to read next

Open `INTERVIEW_FLOW.md` for the human story and function sequence, then `EVALUATION.md` for justifying each technology and explaining the measured vs unmeasured performance.

## Added release modules

| File under backend/app | Responsibility |
|---|---|
| api/modeling.py | Join previews and approvals, customer sources, feedback, outreach status and report forecast preferences |
| data/modeling.py | Key normalization, uniqueness, unmatched counts, row-preserving joins |
| analytics/customer_growth.py | Customer KPIs, individual purchasing histories, RFM and seasonal observations |
| analytics/engagement.py | Workspace follow-up events and feedback statistics |
| agents/business_evidence.py | Active customer history, forecast calculation and common results for report and chat |
| forecasting/service.py | Monthly and grouped forecasts, chronological evaluation |
| rag/retrieval.py | Dataset-scoped hybrid retrieval and optional persistent semantic index |

The demo folder contains the original four synthetic fashion CSVs and their data dictionary. The release integration test is backend/tests/test_growth_release.py.

## Complete release inventory

```text
.env.example
.gitignore
DEMO_RETAIL_20000.csv
Dockerfile
EVALUATION.md
INTERVIEW_FLOW.md
README.md
START_HERE_WINDOWS.md
TESTING.md
backend/.dockerignore
backend/.env.example
backend/Dockerfile
backend/app/__init__.py
backend/app/agents/__init__.py
backend/app/agents/agent_01_data_profile.py
backend/app/agents/agent_02_analytics.py
backend/app/agents/agent_03_knowledge_retrieval.py
backend/app/agents/agent_04_insight_reporting.py
backend/app/agents/business_evidence.py
backend/app/agents/workflow.py
backend/app/analytics/__init__.py
backend/app/analytics/business_insights.py
backend/app/analytics/customer_growth.py
backend/app/analytics/engagement.py
backend/app/analytics/query_service.py
backend/app/analytics/retail_report.py
backend/app/analytics/service.py
backend/app/api/__init__.py
backend/app/api/analyst.py
backend/app/api/analytics.py
backend/app/api/cleaning.py
backend/app/api/data_query.py
backend/app/api/datasets.py
backend/app/api/decision.py
backend/app/api/forecasting.py
backend/app/api/modeling.py
backend/app/api/portal.py
backend/app/api/rag.py
backend/app/auth/__init__.py
backend/app/auth/store.py
backend/app/cleaning/__init__.py
backend/app/cleaning/pipeline.py
backend/app/config.py
backend/app/data/__init__.py
backend/app/data/dataset_service.py
backend/app/data/domain_detection.py
backend/app/data/ingestion.py
backend/app/data/modeling.py
backend/app/data/profiling.py
backend/app/data/schema_detection.py
backend/app/decision/__init__.py
backend/app/decision/engine.py
backend/app/decision/service.py
backend/app/evaluation/__init__.py
backend/app/evaluation/retrieval_metrics.py
backend/app/forecasting/__init__.py
backend/app/forecasting/service.py
backend/app/main.py
backend/app/rag/__init__.py
backend/app/rag/celery_app.py
backend/app/rag/retrieval.py
backend/app/rag/tasks.py
backend/app/schemas/__init__.py
backend/app/schemas/analyst.py
backend/app/schemas/analytics.py
backend/app/schemas/cleaning.py
backend/app/schemas/data_query.py
backend/app/schemas/dataset.py
backend/app/schemas/decision.py
backend/app/schemas/forecasting.py
backend/app/schemas/rag.py
backend/app/shared/__init__.py
backend/app/shared/llm_service.py
backend/pyproject.toml
backend/requirements-dev.txt
backend/requirements-semantic.txt
backend/requirements.txt
backend/scripts/analyst_benchmark_template.jsonl
backend/scripts/evaluate_analyst_agent.py
backend/scripts/evaluate_cleaning.py
backend/scripts/evaluate_rag_retrieval.py
backend/scripts/rag_benchmark_retail_example.jsonl
backend/scripts/rag_benchmark_template.jsonl
backend/scripts/run_evaluation.py
backend/tests/test_active_cleaned_dataset.py
backend/tests/test_active_cleaned_source.py
backend/tests/test_analyst_graph.py
backend/tests/test_analytics.py
backend/tests/test_api.py
backend/tests/test_cleaning.py
backend/tests/test_cleaning_semantic_guard.py
backend/tests/test_data_query.py
backend/tests/test_flexible_retail_report.py
backend/tests/test_forecasting.py
backend/tests/test_growth_release.py
backend/tests/test_high_missingness_safety.py
backend/tests/test_loader_formats.py
backend/tests/test_portal_store.py
backend/tests/test_profiler.py
backend/tests/test_rag_evaluation.py
backend/tests/test_release_regression.py
backend/tests/test_report_preview.py
backend/tests/test_retail_reporting_v08.py
backend/tests/test_schema_semantic_precision.py
demo/DATA_DICTIONARY.md
demo/FASHION_CUSTOMERS_2600.csv
demo/FASHION_FEEDBACK_750.csv
demo/FASHION_PRODUCTS_165.csv
demo/FASHION_SALES_15000.csv
docker-compose.yml
docs/FILE_MAP.md
frontend/.dockerignore
frontend/.gitignore
frontend/.oxlintrc.json
frontend/Dockerfile
frontend/README.md
frontend/index.html
frontend/nginx.conf
frontend/package-lock.json
frontend/package.json
frontend/public/favicon.svg
frontend/public/icons.svg
frontend/src/App.css
frontend/src/App.jsx
frontend/src/components/BusinessReport.css
frontend/src/components/BusinessReport.jsx
frontend/src/components/GrowthWorkspace.css
frontend/src/components/GrowthWorkspace.jsx
frontend/src/index.css
frontend/src/main.jsx
frontend/src/services/api.js
frontend/vite.config.js
```
