# INSIGHT AI — Evaluation and model choices

**Start here if an interviewer asks, "How good is the cleaning, model, RAG or agent system?"** This is a readable account of what the code actually does and what the evidence proves. **There is no single accuracy percentage for the entire application.**

## 1. Quick evaluation map

| Part | Why use it? | How to judge it | Verified in this release? |
|---|---|---|---|
| EDA / profiling | Understand unknown uploaded datasets | Correct row/column/type/missing/duplicate counts | Unit tests; synthetic smoke audit |
| Data cleaning | Prepare trustworthy data while preserving raw input | Before/after quality and labelled correction accuracy | 20k-row synthetic audit; not labelled correction accuracy |
| Four agents | Separate planning, calculations, retrieval and explanation | Correct route, calculations, trace, factual answer | Targeted components tested; no live LLM success rate |
| RAG | Retrieve relevant dataset descriptions | Hit@K, Precision@K, Recall@K, MRR, faithfulness | Metric helper tested; live retrieval **not measured** |
| Supervised ML | Predict numeric/categorical targets | Holdout MAE/RMSE/R² or F1 vs baseline | Synthetic models run and evaluated |
| Forecasting | Estimate next periods from time trends | Chronological backtest MAE/RMSE/WAPE | Synthetic time-series backtest run |
| Publishing / viewer | Share only assigned report snapshots | Authentication, redemption, role tests, browser E2E | Portal-store tests; browser E2E **not verified** |

## 2. EDA: what happens first?

Code: `backend/app/data/profiling.py`, `schema_detection.py`, `domain_detection.py`.

Pandas reads CSV/Excel/JSON. We inspect row count, column count, sample values, data types, missing values, duplicate rows, numeric statistics, and likely business meaning. The profile is saved to `profile.json` for other modules. Schema suggestions are **heuristics**, not infallible AI labels.

The **data quality score** is a heuristic display measure. The source formula is:

```text
quality = max(0, 100
    - min(missing_percent * 0.4, 40)
    - min(duplicate_percent * 0.3, 30)
    - (constant_column_count / number_of_columns) * 10)
```

A high quality score means few *detected* issues, not proof that prices, dates or business logic are correct.

## 3. Cleaning: what is good, and what is still limited?

Code: `backend/app/cleaning/pipeline.py`.

**Story:** The admin sees recommendations first; cleaning is applied only when requested. The pipeline makes a copy and preserves the original upload. It suggests median for suitable numeric columns, mode for categories, and leaves identifiers/dates and columns with 50%+ missingness for review. IQR highlights potential outliers without automatically declaring all of them mistakes. Optional approved actions include missing-value imputation, duplicate removal, row removal and outlier capping.

**Why the median?** Unlike the mean, it is less affected by extreme numbers. **Why the mode?** It is a straightforward replacement for missing categories. Neither method knows the true missing value, so business review still matters.

**Important conversion safety:** Currency-formatted values such as `$86.31`, `₹1,250` and parenthesized negatives can be parsed, but nonempty text that cannot be converted safely is not silently replaced with null. An incorrectly detected `sales_channel` column must remain text. Tests cover that safeguard.

### Measured synthetic retail audit

Using `INSIGHT_AI_Retail_Test_20000.csv` and this release's `scripts/evaluate_cleaning.py`:

| Measure | Before | After |
|---|---:|---:|
| Rows | 20,000 | 19,808 |
| Columns | 23 | 23 |
| Missing cells | 1,409 | 154 |
| Exact duplicate rows | 192 | 0 |
| Original file modified | No | No |

1,255 missing cells were reduced and 192 exact duplicates were removed. **This is not "89% cleaning accuracy."** We do not know that each imputed value equals the unknown true value. We have not fully evaluated invalid dates, business-rule inconsistencies, distribution drift or causal data errors.

Reproduce on your own data (from `backend/`):

```cmd
python scripts/evaluate_cleaning.py --csv C:\Data\retail.csv --output cleaning_evaluation_result.json
```

The script does not modify the input CSV. For rigorous cleaning *accuracy*, create a test dataset with known true values, deliberately corrupt some cells, and compare recovered values against the known originals.

## 4. Supervised ML: why these models, and how is the winner chosen?

Code: `backend/app/prediction/model_engine.py`, `app/prediction/service.py`.

**Auto target type:** Numeric target → regression; nonnumeric/category target → classification, where appropriate. The UI suggests a target, but the admin can override it. A forecast metric and a supervised target are not necessarily the same thing.

**Candidate models:**

- Regression: Linear Regression, Decision Tree Regressor, Random Forest Regressor.
- Classification: Logistic Regression, Decision Tree Classifier, Random Forest Classifier.

Linear/logistic regression offers a simple interpretable benchmark. Decision trees handle nonlinear splits. Random Forest combines trees to reduce instability. The app compares candidates instead of assuming one is always best.

**Evaluation order:** Prepare features with a scikit-learn pipeline → split 80% train/20% holdout → choose the candidate through cross-validation **within training data** → fit it → evaluate on untouched holdout → compare against a dummy baseline → save the model and preprocessing together.

- Regression candidate selection: lowest cross-validation RMSE; report MAE, RMSE and R².
- Classification candidate selection: highest weighted F1; report accuracy, weighted precision, recall and F1.
- **MAE:** average size of an error. **RMSE:** penalizes large errors more. **R²:** how much variation the model explains relative to a constant predictor. **F1:** balance of precision and recall.

**Measured synthetic fixture, rerun in this release:**

| Task | Chosen | Held-out result | Dummy baseline |
|---|---|---|---|
| Regression | Linear Regression | MAE 0.3763, RMSE 0.4786, R² 0.9659 | MAE 2.1120, RMSE 2.6234 |
| Classification | Random Forest | Accuracy 0.9792, weighted F1 0.9792 | Accuracy 0.5208, weighted F1 0.3567 |

These numbers prove that a fixed **synthetic fixture** is learnable. They do **not** prove that all uploaded real businesses achieve 97.92% accuracy. Random splits may leak time or repeated customer effects; for such datasets, time-aware or grouped validation is necessary.

Reproduce (from `backend/`):

```cmd
python scripts/run_evaluation.py
```

## 5. Forecasting: why not use Random Forest for every next-month prediction?

Code: `backend/app/prediction/forecasting.py`.

Time order matters. The time-series module groups date/numeric transactions into monthly (or chosen-frequency) totals, checks history, and compares two intentionally simple methods:

- **Linear trend:** assumes the historical trend may continue.
- **Last-value baseline:** assumes the next period may resemble the latest observed period.

It tests on the **latest historical periods**, selects the lower backtest MAE, refits the chosen method, and produces next-period estimates. It requires at least ten valid periods and explicitly flags negative transactions that might be returns or corrections. Segment forecasts for supported products/categories/regions are also provided. Forecasts are estimates, not proof of external business causes.

**Measured synthetic forecast fixture, rerun in this release:** Linear trend MAE **2.7247**, RMSE **3.4047**, WAPE **1.68%**; last-value baseline MAE **7.8104**, RMSE **8.8531**, WAPE **4.82%**.

**WAPE** = total absolute error / total actual magnitude × 100. It can be undefined around a zero denominator. The current forecast does not automatically model holidays, competitor pricing, promotions, stockouts or supplier lead times. Never pretend that a demand forecast is a known warehouse-stock quantity.

## 6. RAG: why use it, and how can it be evaluated?

Code: `backend/app/rag/retrieval.py`, `backend/app/evaluation/retrieval_metrics.py`.

**RAG = Retrieval-Augmented Generation.** The app does not assume a language model knows the uploaded business data.

1. `build_dataset_documents()` makes searchable descriptions from the dataset overview, column profiles and quality warnings (not every raw row).
2. `all-MiniLM-L6-v2` converts those descriptions into embeddings: numbers representing semantic similarity.
3. ChromaDB stores them in a separate dataset collection.
4. `retrieve_documents()` finds top-*K* matching documents.
5. The AI Analyst may use that context to explain a result; **Pandas calculates actual totals**.

**Why MiniLM?** Compact local text embeddings. **Why ChromaDB?** Simple persistent vector search. **Why LangChain?** Common interfaces connecting retrieval and language-model components. **Why Groq?** Hosted LLM inference; access requires a valid key and supported model.

Evaluate with a human-labelled question set and relevant document IDs:

```cmd
python scripts/evaluate_rag_retrieval.py --dataset-id YOUR_DATASET_ID --cases scripts/rag_benchmark_retail_example.jsonl --k 5 --output rag_evaluation_result.json
```

- **Hit@5:** proportion of questions retrieving at least one relevant document.
- **Precision@5:** relevant items divided by retrieved items at top 5.
- **Recall@5:** relevant retrieved items divided by all labelled relevant items.
- **MRR@5:** favors placing the first relevant document near the top.

Index the dataset **before** running a real retrieval benchmark. This release does **not** have a measured live RAG Precision@5, Recall@5 or faithfulness score. Unit tests of the metric formulas do not equal successful real-world retrieval.

## 7. Agentic AI: four agents, one workflow

Code: `backend/app/agents/workflow.py` and `agent_01...agent_04`.

1. **Data Profile Agent** validates the question against dataset schema and plans its tools.
2. **Analytics Agent** runs numerical calculations with Pandas when needed.
3. **Knowledge Retrieval Agent** retrieves indexed dataset metadata when needed.
4. **Insight & Reporting Agent** produces the final explanation, grounded in those findings.

LangGraph manages conditional transitions and an `execution_trace`. It can skip retrieval or analytics if unnecessary. That is **one agentic workflow with four agent roles**, not four independent apps. The viewer's published-report chatbot is a separate, snapshot-scoped endpoint.

Agent quality needs a benchmark with correct expected answers, expected node paths, factuality checks, exception-free completion and latency. You can run:

```cmd
python scripts/evaluate_analyst_agent.py --dataset-id YOUR_DATASET_ID --cases scripts/analyst_benchmark_template.jsonl --output analyst_agent_evaluation_result.json
```

This produces coverage/trace/response checks. **No validated universal agent factuality score is provided.** A well-formed response is not automatically correct.

## 8. How to answer "How accurate is your project?"

> "Different parts need different evaluations. I test data preparation using known counts and before/after audits. For supervised ML, we compare models with cross-validation and a separate holdout versus a baseline. Forecasting uses chronological backtests instead of shuffled splits. The RAG and LangGraph parts have evaluation scripts and traces, but I will only give retrieval or factuality accuracy after running a labelled benchmark. I don't claim one universal accuracy number for an AI platform."

**Remaining verification:** Full browser admin-to-viewer journey, frontend production build in a fully provisioned Node environment, full LangGraph execution with installed dependencies, Groq inference, and real indexed RAG benchmark. See `TESTING.md`.
