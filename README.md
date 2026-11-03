# INSIGHT AI

AI-assisted business intelligence for structured datasets. This version focuses on historical business analysis, understandable explanations, and evidence-based reporting. Predictive Intelligence and Decision Engine are not exposed as separate navigation pages in this release; future forecasting is listed in the roadmap.

## Project structure

- `backend/`: FastAPI API, profiling, cleaning, analytics, business intelligence, LangGraph analyst and RAG services.
- `frontend/`: React + Vite application.
- `backend/storage/`: runtime uploads and generated vector-store data. This directory is intentionally empty in the source package.

## Backend setup (Windows CMD)

```cmd
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
notepad .env
uvicorn app.main:app --reload
```

Add your own Groq API key to `backend/.env`. Never commit `.env`. API docs: `http://127.0.0.1:8000/docs`.

## Frontend setup (second CMD window)

```cmd
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Current business-analysis capabilities

- Dataset preview with search and pagination.
- Column profile and semantic detection.
- Separate data preparation workflow with before/after validation.
- Historical business context: derived revenue from usable price × quantity, category/product revenue where columns exist, monthly revenue comparison and data limitations.
- AI analyst responses instructed to use plain-language paragraphs and evidence from deterministic analytics.
- Interactive analytics and report interpretations.

## Important limitations

- Product-specific analysis requires a product-name field. Category-only datasets can support category-level analysis, not product rankings.
- Revenue is derived only when usable price and quantity columns exist and no suitable revenue field is available. Confirm that the price/quantity fields represent the intended business calculation.
- Stock purchase quantities are not invented. Inventory recommendations require stock-on-hand, supplier lead time, reorder policy and demand context.
- Historical patterns are not guaranteed forecasts. Future forecasting is a planned enhancement.
- Rebuild the RAG index for newly uploaded datasets. The local ChromaDB data is not included in this source package.

## Validation notes

Python source compilation and the analytics, profiler and data-query test groups were checked during preparation. Full API/AI tests and a production Vite build still need to be run in the target Windows environment after installing all dependencies.

## Management report narrative

The report now includes deterministic, evidence-led narrative sections for overall business performance, monthly sales volume, product performance, category performance, regional performance, and data reliability. These paragraphs are generated from the dataset metrics rather than relying on an LLM to invent values. If a required field is absent, the report explicitly explains why that analysis is unavailable. AI-generated interpretation remains supplementary and must not override calculated metrics.

## Product positioning

INSIGHT AI is designed to automate repeatable data preparation, descriptive analytics, business-question answering and recurring report production commonly performed with spreadsheets and BI dashboards. It is a decision-support system, not a guarantee of replacing every human analyst responsibility. Business context, data governance, causal investigation, forecasting validation and consequential decisions still require human review.
