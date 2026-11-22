# Run INSIGHT AI on Windows

Extract the whole ZIP. The example below assumes the resulting folder is `%USERPROFILE%\Downloads\INSIGHT_AI`. If you extracted elsewhere, substitute your folder. Use **Command Prompt (cmd.exe)**. Install Python 3.12 and a current Node 24.x release with npm first.

## 1. Start the backend

Open the first Command Prompt.

```bat
cd /d "%USERPROFILE%\Downloads\INSIGHT_AI\backend"
py -3.12 -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
copy .env.example .env
notepad .env
```

In the editor, set `INSIGHT_ADMIN_EMAIL` and `INSIGHT_ADMIN_PASSWORD` to the administrator login you want. The first startup creates this account. Generate a signing secret with the following command and paste the result into `INSIGHT_AUTH_SECRET`.

```bat
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

For hosted AI explanations, set your own `GROQ_API_KEY` and an available `GROQ_MODEL` in the backend .env. The core demo, customer and forecast answers, local retrieval, and publishing work without a provider key. Save the file. Start the server.

```bat
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000/health**. Look for `"status":"healthy"`. Keep this terminal open.

## 2. Start the frontend

Open a second Command Prompt.

```bat
cd /d "%USERPROFILE%\Downloads\INSIGHT_AI\frontend"
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173**, choose Admin, and sign in using the values you set. The frontend defaults to the local backend. To change that address, put `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` in frontend/.env.local and restart Vite. Configure FRONTEND_URL in backend/.env if the frontend origin changes.

## 3. Run the fashion demo

1. Upload `demo\FASHION_SALES_15000.csv`. Review Data Health and approve the desired cleaning steps.
2. Open **Data Modeling**. Upload `FASHION_CUSTOMERS_2600.csv`. Preview the customer_id relationship. Walk-in sales can have no identified customer. Approve the left join to preserve those transactions.
3. Open Data Modeling again. Upload `FASHION_PRODUCTS_165.csv`, preview the sku join, and approve. Sales are still at order-line grain.
4. Open **Customer Growth**. Upload `FASHION_FEEDBACK_750.csv` in the feedback field. Open a customer's name to see orders by year, spending, seasons and stores. Review a draft or record a follow-up status. The optional purchase-history upload replaces the customer analysis source for this workspace. Keep the same customer IDs when loading later purchases to track returns.
5. Open **Forecasting**. Choose a measure and 36 months, then apply. A horizon longer than the observed history shows an explanation. Inspect the chart, model and holdout error.
6. In **AI Business Analyst**, ask “How many customers are overdue?” or “What is the forecast?”.
7. Open **Reports**. Inspect the four tabs, then publish. Copy the access code. Open a separate browser profile or InPrivate window, choose Viewer, create an account with that code, and open Customer Growth and the Future report page. The viewer reads the snapshot saved at publication.

## 4. Stop and restart

Use Ctrl+C in each terminal. The next time you run the project, activate the same backend environment and repeat the two server-start commands. SQLite accounts, datasets, follow-up records and published reports persist in backend/storage. Keep that directory private. Use the same browser profile to reopen the most recent admin workspace.

## 5. Run the checks

Run tests against a temporary store so demo accounts and reports stay separate.

```bat
cd /d "%USERPROFILE%\Downloads\INSIGHT_AI\backend"
call .venv\Scripts\activate.bat
set "STORAGE_DIR=%TEMP%\insight-test-%RANDOM%"
set "DATABASE_URL=sqlite:///%STORAGE_DIR%/test.sqlite3"
python -m pytest -q
set STORAGE_DIR=
set DATABASE_URL=
cd ..\frontend
npm run build
```

## Optional semantic embeddings

The default hybrid retriever combines exact-term TF-IDF and latent semantic vectors locally. To enable MiniLM with persistent Chroma, install `python -m pip install -r requirements-semantic.txt`, set `SEMANTIC_EMBEDDINGS=true` in backend/.env, restart and index the dataset. The first MiniLM run downloads its weights. Redis and Celery workers are needed only for the asynchronous indexing endpoint.
