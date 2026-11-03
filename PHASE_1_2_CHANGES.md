# INSIGHT AI update notes

## Product direction
The app is repositioned around historical business intelligence rather than presenting EDA/cleaning as the main outcome. Predictive Intelligence and Decision Engine are removed from the primary sidebar for this release. A Coming Soon page documents planned capabilities.

## Frontend changes
- Sidebar labels: Data Explorer, Data Pipeline, Analytics Studio, AI Business Analyst.
- Removed separate Predictive Intelligence and Decision Engine navigation items.
- Added a Coming Soon roadmap page.
- Data Explorer now includes a searchable, paginated preview of actual dataset rows and a column dictionary.
- Overview includes a business snapshot, business KPI strip and compact category/trend mini charts when the data supports them.
- Data Pipeline includes a four-stage flow and clarifies automated cleaning decisions and before/after results.
- Analytics Studio charts have compact styling and explanatory text.
- Report charts include expandable chart explanations.
- Sidebar active/hover states use a subtle dark accent instead of a white active container.
- AI question suggestions focus on sales, revenue, products, categories and historical trends.

## Backend changes
- Semantic inference recognises identifier, date, price, quantity, revenue, product and category fields more consistently.
- Numeric-looking text (including common currency symbols and comma separators) can be recognised as numeric during profiling.
- Analytics uses a working copy and safely parses numeric-looking values.
- Derived revenue is calculated as price × quantity only when no revenue field is available and compatible price and quantity columns exist. The original dataset is not modified.
- Identifier columns are excluded from numeric summaries and correlations.
- Dataset rows API supports pagination and search across all columns.
- Added deterministic business context: total revenue, quantity, monthly revenue, latest-month comparison, category/product revenue rankings, data quality and explicit limitations where supported.
- AI analyst and report prompts now prioritise historical business performance and plain-language paragraph answers.
- Report generation receives deterministic business observations as evidence.
- Backend requirements now include the AI, RAG, orchestration and ML dependencies imported by the project.

## Known limitations and verification
- No product-level recommendations can be generated when the dataset lacks a product-name column.
- No specific stock order quantity is recommended without inventory and supply-chain inputs.
- Future sales forecasting remains future work; the application should not present historical summaries as guaranteed predictions.
- Python compile checks passed. 15 analytics/profiler/data-query tests passed. Full pytest collection is blocked in the preparation environment because LangGraph is not installed. Frontend JSX syntax was parsed successfully, but Vite build was not verified because dependency installation did not complete in this environment.
