# Release 05 — Simple, interview-friendly source structure

## What changed from Release 04

- Renamed `01_backend`, `02_frontend` to `backend`, `frontend`.
- Replaced `p01_app/p01_api/p01_routes/f01_...` packages with readable `app/api/*.py` modules.
- Collected all cleaning logic inside `app/cleaning/pipeline.py`; grouped RAG retrieval and indexing worker in `app/rag/`.
- Collected the four numbered agent files and the coordinating `workflow.py` inside `app/agents/`.
- Moved automated tests into `backend/tests/` and evaluation scripts into `backend/scripts/`.
- Updated all internal imports, unit tests, Docker/Compose paths, and `uvicorn` entry points.
- Added short, practical comments to the key backend hand-offs.
- Replaced overlapping release documents with a simple README, Windows startup instructions, an interview story, file map, evaluation guide, and testing guide.
- Preserved the existing React screens and charting behavior; no speculative UI rewrite.
- Excluded old runtime SQLite data and generated files from the deliverable.

## What was verified

- Python compilation, 59 tests, synthetic model/forecast evaluation, and 20,000-row cleaning audit.

## Important limits

- No claim of live RAG/agent factuality scores or frontend browser E2E verification.
- The React `App.jsx` is still a large single component file; this release prioritizes not breaking working screens. A later UI extraction would require full browser regression testing.
- The backend continues to depend on optional heavy AI/RAG packages for the complete agent flow, and external Groq access depends on user configuration.

**New import entry point:** `uvicorn app.main:app --reload` from `backend/`.


## Release 06
See `RELEASE_06_FIXES_AND_TESTS.md` and `DEPLOYMENT_REALITY_AND_NEXT_STEPS.md` for exact implemented changes, testing limitations and hosting plan.
