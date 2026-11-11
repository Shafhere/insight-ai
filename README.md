> **Release 09:** Retail reports now adapt to ordinary sales exports (including a 250-row demo), while retaining detailed inventory dashboards for richer datasets. See [Release 09 notes](RELEASE_09_FLEXIBLE_DATASETS.md).

> **Release 08 update:** This source prioritizes retail and e-commerce historical analytics; predictions and forecasts are marked as future workflow. Read [RELEASE_08_RETAIL_ANALYTICS.md](RELEASE_08_RETAIL_ANALYTICS.md) before your demo.

# INSIGHT AI

**From Data to Decisions.** Upload a CSV/Excel dataset, understand it, clean it, analyze it, ask questions, forecast business metrics, publish a report, and share that report with an authorized viewer.

This release keeps the existing React UI and backend behavior but replaces deeply nested numbered Python packages with clear names. The code includes short comments at important hand-offs. It is intended to be **easy to navigate and explain**, not an artificial collection of microservices.

## Read these files in this order

1. **`START_HERE_WINDOWS.md`**: install and start the app without Docker.
2. **`INTERVIEW_FLOW.md`**: tell the entire project story while opening real files and functions in VS Code.
3. **`docs/FILE_MAP.md`**: one-page map of the project and important frontend screens.
4. **`EVALUATION.md`**: why each technique was chosen, what its metrics actually mean, and what remains unverified.
5. **`TESTING.md`**: practical validation and limitations.

## Small, readable project structure

```text
INSIGHT_AI/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application and access control
│   │   ├── config.py         # Environment settings and storage
│   │   ├── api/              # Browser-facing endpoints
│   │   ├── auth/             # Admin/viewer login, access-code records
│   │   ├── data/             # Upload, loading, EDA, profiling
│   │   ├── cleaning/         # Cleaning suggestions and approved actions
│   │   ├── analytics/        # Verified KPIs, trends and group calculations
│   │   ├── agents/           # Four agents and their LangGraph workflow
│   │   ├── rag/              # Embeddings, ChromaDB and optional worker
│   │   ├── prediction/       # ML models and time-series forecasts
│   │   ├── decision/         # Evidence-based business recommendations
│   │   ├── schemas/          # Request/response data shapes
│   │   ├── evaluation/       # Retrieval metric helpers
│   │   └── shared/           # Shared LLM connection
│   ├── tests/                # Unit and regression tests
│   ├── scripts/              # Evaluation scripts and sample questions
│   ├── storage/              # Local runtime data, not shipped in ZIP
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx           # Admin and viewer screens
│       ├── App.css           # Shared theme and component styling
│       └── services/api.js   # Browser calls to FastAPI
├── docs/FILE_MAP.md
├── START_HERE_WINDOWS.md
├── INTERVIEW_FLOW.md
├── EVALUATION.md
└── TESTING.md
```

**Why just one `App.jsx`?** The existing UI is large, and splitting it without a complete browser regression test could break a working interface. All screens are clearly named functions; use `Ctrl+F` or `Ctrl+Shift+O` in VS Code to jump to a screen. Frontend restructuring was intentionally *not* a risk taken in this release. Refer to `docs/FILE_MAP.md` for the page list.

## User journey

`Admin login → Upload → EDA → Data health → Cleaning preview/approval → Analytics → Four-agent analyst (RAG when needed) → Predictive ML and forecasts → Decisions → Publish snapshot → One-time code → Viewer signup/login → Viewer dashboard/report/chat`

For an interview dataset, upload **`DEMO_RETAIL_20000.csv`** (synthetic example, not real customer data). It contains missing values, duplicates and business fields useful for a live demonstration.

The design answers four business questions: **What happened? Why? What is likely to happen? What should we do?**

## Main technologies and their actual jobs

| Technology | Why INSIGHT AI uses it |
|---|---|
| Python + FastAPI | Validated API requests, route handling and backend logic |
| Pandas + NumPy | Read and clean data, EDA, calculations and statistics |
| React + Vite | Interactive administrator and viewer portals |
| Recharts | Business charts and KPI visualizations |
| LangGraph | Routes one AI Analyst question through up to four agent nodes |
| Groq + LangChain | Hosted LLM generation and integrations (requires a valid API key/model) |
| Sentence Transformers + ChromaDB | Embedding and semantic retrieval of **dataset metadata** |
| scikit-learn | Supervised candidate models, metrics, simple forecasting |
| SQLAlchemy + SQLite/PostgreSQL | Accounts, published snapshots, and viewer access-code records |
| Celery + Redis | Optional asynchronous RAG knowledge indexing |

**Accuracy is dataset-dependent.** The EDA quality score is a heuristic, not an AI accuracy rate. Forecasts have chronological backtests. Live RAG/agent accuracy has not been independently certified. See `EVALUATION.md`.

## Running without Docker

Read **`START_HERE_WINDOWS.md`** first. In brief: run `uvicorn app.main:app --reload` from `backend/` and `npm run dev` from `frontend/`, using separate terminals.

For an optional Docker environment, `docker-compose.yml` and the relevant Dockerfiles remain included. The package contains no real API keys, installed dependencies, uploaded customer datasets, or previously created database.
