# INSIGHT AI frontend (React)

The UI is written in **React + Vite + Recharts**. It has the Admin Portal and the restricted Viewer Portal. The source was deliberately **not split into many nested components** during this backend refactor, because it would require complete browser regression testing.

## Where to begin

- `src/main.jsx` — mounts React's `<App />`.
- `src/App.jsx` — page functions: `AuthPage`, `ViewerPortal`, `OverviewPage`, `DataUnderstandingPage`, `DataHealthPage`, `CleaningPage`, `AnalyticsPage`, `AIAssistantPage`, `PredictivePage`, `ForecastPage`, and `ReportsPage`.
- `src/services/api.js` — API calls and bearer token sent to FastAPI.
- `src/App.css` — shared visual design, light/dark themes and layout.

Use `Ctrl+F` in VS Code to jump to the function named for a page. The full user journey and matching backend functions are in root `INTERVIEW_FLOW.md`.

## Run

```cmd
npm ci
npm run dev
```

Start the FastAPI backend separately from the `backend/` folder using `uvicorn app.main:app --reload`. Frontend default URL: `http://127.0.0.1:5173`. See root `START_HERE_WINDOWS.md`.
