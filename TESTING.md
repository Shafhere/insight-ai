# Local verification checklist (Windows CMD)

## Backend

```cmd
cd backend
.venv\Scripts\activate
python -m compileall -q app
ruff check app
pytest -q
```

## Frontend

```cmd
cd frontend
npm ci
npm run build
```

## End-to-end business checks

1. Upload a retail dataset with date, unit price, quantity, category, product and branch/location fields.
2. Confirm the preview displays rows and pagination/search works.
3. Run the cleaning workflow and compare before/after counts. Confirm the original file remains available.
4. Compare revenue and quantity by month against an independent spreadsheet calculation.
5. Verify top/low product, category and location rankings against a pivot table.
6. Ask the AI analyst for latest-month vs previous-month sales, top product, low-performing category and regional comparison. Check each number against the calculated analytics.
7. Generate the report and verify each narrative paragraph against the same calculations.
8. Upload a second dataset with different column names and missing dimensions. Confirm unsupported product/location/time analysis is labelled unavailable rather than guessed.
9. Test a dataset without a date field, one without price/quantity, and one with product but no category.
10. Test larger files and malformed dates/numeric strings before deployment.

Do not proceed to production until backend tests, frontend build, and the end-to-end checks pass in the deployment environment.
