# INSIGHT AI — Testing and verification

This release is a **source-code simplification of Release 04**, not a rebuild. Names and imports changed; business algorithms and the existing React UI were deliberately preserved.

## Checks performed while packaging

- Python `compileall`: **passed** after import/path cleanup.
- TypeScript parser syntax check: **0 syntax diagnostics** in `App.jsx`, `main.jsx`, and `services/api.js` (not a production build).
- Backend focused/regression tests (excluding two modules requiring `langgraph`): **59 passed**.
- Synthetic supervised/regression/forecast evaluation: **ran and produced expected model-comparison results**. See `EVALUATION.md`.
- Synthetic 20,000-row retail cleaning audit: **ran**, 192 duplicates removed, 1,409 → 154 missing cells, raw input unchanged.
- Source tree scanned for outdated numbered import paths: no remaining production Python numbered-package imports.
- No saved database, user-uploaded datasets, environment secrets, `.venv`, `node_modules`, or generated ChromaDB index included.

## Not verified here

- Complete backend suite modules that require optional `langgraph`, `langchain_chroma` or `sentence_transformers` packages.
- Live Groq LLM responses, end-to-end RAG semantic retrieval, and agent factuality scores.
- Frontend `npm run build` and real browser light/dark/theme or alignment behavior (dependencies not available in this build environment).
- A complete browser-driven login → upload → clean → forecast → publish → redeem-code demonstration.

Do not treat an untested browser workflow as passed.

## Commands to run on your Windows machine

After installing dependencies in `START_HERE_WINDOWS.md`:

```cmd
cd backend
.venv\Scripts\activate
python -m compileall -q app tests scripts
python -m pytest tests -q
python scripts/run_evaluation.py
```

Frontend:

```cmd
cd frontend
npm ci
npm run build
```

## Your final interview smoke test

- Admin login works with configured credentials; viewer login cannot access admin routes.
- Upload the retail test CSV and compare row/column stats.
- Cleaning preview shows risk and choices; original file remains unchanged; cleaned file available.
- Analytics cards and graphs use actual dataset values.
- Ask **two distinct** business questions; their answers differ and numerical facts match calculations.
- Index RAG before trying to demonstrate document retrieval; check sources, not just the chatbot's style.
- Forecast future months; inspect validation metrics and limitations.
- Publish one report; redeem the code with a new viewer; ensure the code cannot be redeemed twice and viewer sees only their assigned report.
- Inspect all four report pages, light and dark modes, and mobile-sized layout.

If a test fails, report the actual stack trace rather than asserting the application is fully verified.
