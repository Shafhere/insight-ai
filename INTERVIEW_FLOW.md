# INSIGHT AI — Explain the complete code as a user story

**Use this file while sharing VS Code in the interview.** Open files in the sequence below. You do **not** need to memorize 80 modules or every line. Understand the entry point, the hand-off, the reason, and the output.

## Your 30-second introduction

> "INSIGHT AI helps business users turn CSV and Excel data into decisions. An admin uploads data, reviews its quality, approves cleaning, explores dashboards, asks a multi-agent AI analyst, and evaluates ML forecasts. They can then publish a report. A viewer signs in using a report invitation code and sees only their assigned dashboard, report and research chatbot. The system answers: What happened? Why did it happen? What may happen? What should the business do?"

## First explain the three layers

```text
Browser (React + Recharts)     frontend/src/App.jsx
        |
        | HTTP requests / responses
        v
API (FastAPI)                backend/app/main.py and backend/app/api/
        |
        | Function calls
        v
Services and storage        backend/app/data, cleaning, analytics,
                            agents, rag, prediction, decision, auth
```

**Beginner explanation:** React shows the pages, FastAPI receives requests, and backend services do the calculations. The browser does not train models or store the protected report database.

## The actual execution order (admin journey)

### 1. Admin logs in

1. In the UI, find **`AuthPage`** in `frontend/src/App.jsx`.
2. It calls `adminLogin()` in `frontend/src/services/api.js`.
3. The HTTP request goes to `backend/app/main.py`, which registers routers and protects endpoints.
4. In `backend/app/api/portal.py`, `admin_login()` checks credentials.
5. In `backend/app/auth/store.py`, `verify_password()` checks the password hash and `create_token()` creates a signed login token.
6. The browser sends that token on later requests; `authenticate_request()` checks it and the user's role.

**Say:** "Admin and viewer login are distinct. We check roles on the backend, not only by hiding buttons in React."

### 2. Admin uploads a dataset

1. In `frontend/src/App.jsx`, `App` handles the upload. `uploadDataset()` is in `services/api.js`.
2. FastAPI: `backend/app/api/datasets.py` → `upload_dataset()`.
3. The file is saved by `backend/app/data/dataset_service.py` → `save_upload()`.
4. `backend/app/data/ingestion.py` → `load_dataset()` reads the supported CSV/Excel/JSON file with Pandas.
5. `backend/app/agents/agent_01_data_profile.py` → `profile_uploaded_dataset()` invokes `analyse_saved_dataset()`. This upload-time helper is **ordinary deterministic profiling**, not proof that a LangGraph conversation has started.

**Output:** An unchanged original file is stored under `backend/storage/<dataset-id>/` and the profile is saved as `profile.json`.

### 3. EDA: understand the data

Open `backend/app/data/profiling.py` → `profile_dataset()`.

- Counts rows, columns, missing cells, duplicates, sample values and numeric summaries.
- Uses `schema_detection.py` to suggest semantic types such as date, price, identifier, revenue or quantity.
- Uses `domain_detection.py` for a best-effort business domain label.
- Computes a **heuristic quality score**. It is *not* a ML validation accuracy.

**Say:** "EDA is the inspection phase. Before cleaning or training, we need to know the shape and quality of the data."

### 4. Data Health and cleaning

1. React `CleaningPage` calls `getCleaningPreview()` in `services/api.js`.
2. `backend/app/api/cleaning.py` receives the request.
3. `backend/app/cleaning/pipeline.py` → `preview_cleaning()` detects missingness, exact duplicates and potential IQR outliers. `suggest_strategy()` proposes a reasonable per-column action.
4. The admin reviews the recommendations. The apply request goes to `apply_dataset_cleaning()` → `run_cleaning()` → `apply_cleaning()`.
5. The result is saved separately as `cleaned.csv` and `cleaning_report.json`, while the original upload is preserved. The following pages can explicitly select `source=cleaned`.

**Say:** "We do not blindly convert categories or identifiers into numbers. Numeric parsing has a safety guard; high-missingness and date/ID columns require careful review. Outliers can be real business sales, so IQR flags are suggestions."

### 5. Analytics: what happened, and why might it have happened?

1. React `OverviewPage` and `AnalyticsPage` request charts using functions like `getAnalyticsOverview()` in `services/api.js`.
2. `backend/app/api/analytics.py` calls `calculate_overview()`, breakdowns, trends and correlations in `backend/app/analytics/service.py`.
3. `backend/app/analytics/business_insights.py` builds contextual summaries where relevant.
4. Pandas, not the LLM, calculates totals, group-by sums and trends.

**Say:** "Our business KPIs are computed directly from the chosen dataset. A change in sales can be observed from the data, but proving a root cause needs more evidence."

### 6. AI Business Analyst: ask a question

**Example:** "Which category had the highest revenue?"

1. `AIAssistantPage` calls `askAnalyst()` in `frontend/src/services/api.js`.
2. `backend/app/api/analyst.py` → `ask_ai_analyst()` → `backend/app/agents/workflow.py` → `run_ai_analyst()`.
3. The `LangGraph` state enters **Agent 1**: `agent_01_data_profile.py`. It uses the saved profile/schema to plan the question (`plan_question()`).
4. **Agent 2**: `agent_02_analytics.py` runs verified Pandas calculations (`run_analytics()`) if the question needs metrics.
5. **Agent 3**: `agent_03_knowledge_retrieval.py` retrieves indexed metadata (`retrieve_rag_context()`) **only when relevant and available**.
6. **Agent 4**: `agent_04_insight_reporting.py` creates the understandable response (`generate_answer()`), preferably from verified computed values and retrieved context.
7. `run_ai_analyst()` returns the answer and an `execution_trace` showing which agents ran.

```text
Question → Agent 1 (plan)
             ├── Agent 2 (calculate) ──┐
             ├── Agent 3 (RAG) <───────┤   conditional paths
             └─────────────────────────┘
                        ↓
                  Agent 4 (explain) → answer + trace
```

**Important:** This is **one orchestrated, conditional four-node agentic workflow**. It is not four separate deployed apps. Some questions skip analytics or RAG. Cleaning is not a conversational agent.

### 7. What exactly is RAG?

Open `backend/app/rag/retrieval.py`.

1. `build_dataset_documents()` turns the dataset overview, column descriptions and data-quality warnings into short documents. It does **not** embed every transaction row.
2. `get_embedding_model()` loads Sentence Transformers `all-MiniLM-L6-v2` to create numerical vectors.
3. `index_dataset()` stores those documents in a dataset-specific ChromaDB collection.
4. `retrieve_documents()` finds semantically similar documentation for the current question.
5. Retrieved context is passed to the answer generator. **Pandas still does revenue, quantity, sums and averages.**

The user can initiate synchronous indexing via `backend/app/api/rag.py`. Asynchronous indexing is queued through `backend/app/rag/tasks.py` and `celery_app.py`, which require Redis and a worker. Indexing is a separate action; uploading does **not** guarantee the index is already built.

**Say:** "RAG gives the LLM relevant factual context from the uploaded dataset's descriptions. This reduces unsupported answers, but we must evaluate retrieval and factuality; it does not make the model automatically perfect."

### 8. Prediction and forecasting: what could happen next?

Two related but distinct routes:

- **Supervised ML:** `backend/app/api/predictive.py` → `app/prediction/service.py` → `model_engine.py` → `train_model()`. Choose target; compare model candidates; use cross-validation and a held-out test split; save the model and metrics. `predict_saved_model()` loads the saved estimator for future rows.
- **Time-series forecasting:** `backend/app/api/forecasting.py` → `app/prediction/forecasting.py` → `forecast_series()` or `forecast_segments()`. Aggregate dated data, require enough historical periods, test methods on later periods, choose the lower backtest MAE, and estimate the next three periods. Product/region/category segments are supported where the data permits.

**Why separate them?** A random 80/20 split used by generic supervised ML is not suitable for a future-time forecast. Forecasting tests on the latest historical periods in chronological order. Do not say these projections are guaranteed.

### 9. Decisions and report: what should the business do?

1. `backend/app/api/decision.py` invokes `generate_decision_report()` in `backend/app/decision/service.py`, supported by `engine.py` and the current analytics context.
2. React `ReportsPage` gathers the four-page report content: business overview, historical analysis, future outlook, and recommendations/cautions.
3. Publishing calls `publishReport()` in `services/api.js` → `backend/app/api/portal.py` → `publish_report()`.
4. `_build_report_payload()` builds a **fixed report snapshot** with computed results, charts and forecasts. `create_published_report()` in `backend/app/auth/store.py` stores the snapshot and creates a short one-time hashed invitation code.

**Say:** "The code is an invitation, not a password. A viewer must create their own account. Publishing freezes a report snapshot so the viewer doesn't get unrestricted dataset access."

### 10. Another user signs up as a viewer

1. React `AuthPage`/`ViewerPortal` calls `viewerSignup()` or `viewerLogin()`.
2. `backend/app/api/portal.py` → `viewer_signup()` → `backend/app/auth/store.py` → `create_viewer()`: verifies/redempts a one-use access code and stores account/report association.
3. `authenticate_request()` enforces role checking and report ownership.
4. `viewer_reports()` lists allowed reports; `viewer_report()` calls `get_user_report()` to fetch only a report assigned to that viewer.
5. The viewer sees **Dashboard**, **Latest Report**, and **AI Research Agent**. `viewer_report_chat()` answers from the assigned **published snapshot** via `answer_from_published_snapshot()` and restricted context. This is a **different backend path** from the admin's LangGraph analyst.

**Say:** "The viewer can use published findings but cannot upload, clean, train or retrieve another customer's raw dataset."

## Why these technologies, in a sentence each

- **Python/Pandas:** practical, reliable data tables, cleaning and group calculations.
- **FastAPI:** clear, typed API endpoints that connect the browser to Python.
- **React/Vite:** responsive interactive dashboard, easy page state and frontend development.
- **Recharts:** ready-made business chart components.
- **LangGraph:** conditional workflow with shared state and an execution trace across four agent roles.
- **Groq/LLM:** turns verified facts into understandable responses. It should *not invent calculations*.
- **Sentence Transformers:** converts dataset-description text into embeddings.
- **ChromaDB:** persists and retrieves semantically relevant documents per dataset.
- **scikit-learn:** interpretable candidate-model comparison with cross-validation and evaluation.
- **SQLAlchemy:** stores users, reports and code-redemption state, with SQLite locally or PostgreSQL in Docker.

## If the interviewer asks for a particular file

| Question | Open this |
|---|---|
| Where does the whole app start? | `backend/app/main.py` |
| Where is authentication? | `backend/app/api/portal.py`, `backend/app/auth/store.py` |
| Show the EDA calculation | `backend/app/data/profiling.py` |
| Show cleaning and its safety checks | `backend/app/cleaning/pipeline.py` |
| Show your agents | `backend/app/agents/agent_01…04`, `workflow.py` |
| Show RAG | `backend/app/rag/retrieval.py` |
| Show actual ML and accuracy calculation | `backend/app/prediction/model_engine.py` |
| Show chronological validation | `backend/app/prediction/forecasting.py` |
| Show publishing and viewer restrictions | `backend/app/api/portal.py`, `backend/app/auth/store.py` |
| Show React pages and API calls | `frontend/src/App.jsx`, `frontend/src/services/api.js` |

**Last interview rule:** Never confuse an implemented capability with a verified performance result. `EVALUATION.md` explains how to measure each one and what has actually been tested.
