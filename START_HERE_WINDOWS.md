# Start INSIGHT AI on Windows (no Docker)

**Do this inside the extracted `INSIGHT_AI` folder.** Use two Command Prompt terminals. Python 3.12 is recommended.

## First time only

### Terminal 1: backend

```cmd
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend\.env` and set your own strong `INSIGHT_AUTH_SECRET` (32+ random characters), `INSIGHT_ADMIN_EMAIL`, and `INSIGHT_ADMIN_PASSWORD`. Add `GROQ_API_KEY` to enable LLM answers. Default `GROQ_MODEL` is `openai/gpt-oss-120b`; API availability depends on your provider account. **Never share your `.env`.**

### Terminal 2: frontend

From the extracted project folder (open a new CMD):

```cmd
cd frontend
npm ci
```

This installs React/Vite/Recharts dependencies. The first Python install and optional embedding model download also require an internet connection.

## Every time you run the demo

**CMD 1:**

```cmd
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**CMD 2:**

```cmd
cd frontend
npm run dev -- --host 127.0.0.1
```

Open **http://127.0.0.1:5173**. API health: **http://127.0.0.1:8000/health**. FastAPI docs: **http://127.0.0.1:8000/docs**.

If you open new CMD terminals from somewhere else, first `cd` into your extracted project's folder (for example `cd C:\Users\LENOVO\Desktop\INSIGHT_AI`) before the commands above.

## Demonstrate from start to finish

1. Admin login with the credentials in `backend\.env`.
2. Upload the supplied `DEMO_RETAIL_20000.csv` (or your own CSV/Excel dataset) and inspect Data Sources and Data Health.
3. Review cleaning suggestions; approve appropriate steps. The original is preserved separately, while all subsequent analytics, AI calculations, forecasts and new reports automatically use the cleaned file. No new upload is needed.
4. Inspect Analytics Studio; ask the AI Business Analyst **two different, data-specific questions**.
5. Open Predictions & Forecasts, choose a valid date/metric where possible. Forecasting needs at least ten historical periods.
6. Open Reports; approved cleaned data is active automatically after cleaning. Publish the report.
7. Copy the access code. In a private browser window, create a viewer account using the code. Open the Dashboard, Report, and AI Research chatbot.

## Optional RAG knowledge indexing

The analyst's retrieval step needs a **built dataset index**. The synchronous `/datasets/{id}/rag/index` API can build it, though the embedding model may download first and use memory. The asynchronous indexing endpoint requires **Redis + a Celery worker** in addition to the two terminals. Example (with Redis available):

```cmd
cd backend
.venv\Scripts\activate
celery -A app.rag.celery_app.celery_app worker --loglevel=info --concurrency=1
```

Celery's Windows worker support can be limited; for a dependable Redis/Celery demo, use an appropriate Linux/Docker environment. **Basic upload, EDA, charts, local forecasts, and publishing do not require Redis.** Do not present unindexed RAG as a successful retrieval.

## Quick fixes

- `No module named app`: start the backend from **`backend/`**, with the activated virtual environment.
- `No module named langgraph`: run `pip install -r requirements.txt` in the correct environment.
- `vite is not recognized`: run `npm ci` inside **`frontend/`**.
- AI 404 / unauthorized model: check your Groq API key, supported model and account permissions.
- Forecast not available: ensure valid date/numeric target and at least ten time periods.
- Do not accidentally start two servers on the same port.

Read `INTERVIEW_FLOW.md` alongside the source code to explain every step.

## Release 06 specific note

After applying cleaning, **do not download/reupload** the cleaned file: all downstream analysis automatically uses it. A raw comparison is available from the Overview dataset selector. Changes to an already published snapshot require publishing a **new** report. For your GitHub push and hosting cautions, read `DEPLOYMENT_AND_GITHUB.md`.
