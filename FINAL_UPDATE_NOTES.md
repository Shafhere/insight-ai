# INSIGHT AI - Business analyst workflow update

## Main improvement in this package

The management report now has deterministic, dataset-grounded narrative sections covering:
- Overall historical business performance and available reporting period.
- Latest month versus previous month revenue comparison, including percentage movement when mathematically valid.
- Monthly quantity movement where date and quantity fields are available.
- Highest/lowest category revenue comparisons.
- Product revenue rankings where a product/SKU field exists.
- Regional/location revenue comparisons where a location field exists.
- Data reliability, missing cells, duplicate rows and analysis limitations.

These paragraphs are calculated from the uploaded data. Missing dimensions are described as unavailable rather than fabricated. AI interpretation remains supplementary; calculated values are the source of truth.

## Existing workflow retained

- Dataset upload, profiling, column dictionary and preview.
- Separate cleaning pipeline preserving the original dataset.
- Analytics overview, breakdowns, trends and correlations.
- AI business analyst and decision report endpoints.
- Responsive report layout with charts and findings.

## Data and decision safeguards

- Product-level conclusions require a product/SKU column.
- Category-level data supports category comparisons only.
- Monthly comparisons require a valid date field and revenue/quantity metric. Partial periods are not silently treated as complete months.
- Derived revenue is only an estimate when calculated from usable unit price × quantity. Confirm that these fields represent the intended revenue formula.
- Historical quantity is not current stock. Exact reorder recommendations require inventory-on-hand, lead time and replenishment policy.
- Correlation and observed patterns do not establish causes.
- Low sales alone do not justify discontinuing a product.

## Validation status

- Python backend source passed `compileall` syntax compilation.
- Full backend test execution was not completed in this environment because optional project dependencies such as `langchain_groq` / `langgraph` are not installed here.
- Frontend production build was not completed because `node_modules` is not present in this environment.
- Install dependencies in the target environment and run the test commands in `TESTING.md` before production deployment.
