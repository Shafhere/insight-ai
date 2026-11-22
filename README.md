# INSIGHT AI · Customer Growth and Forecasting

INSIGHT AI helps a retailer answer a question revenue alone can hide: **which regular customers have stopped coming back on their usual schedule?** An administrator can connect sales, customers and products, review the evidence, forecast monthly results and publish a four-page business report.

**Start with [START_HERE_WINDOWS.md](START_HERE_WINDOWS.md).** It covers extraction, both Command Prompt terminals, local login, all four demo files, the viewer walkthrough, and the commands to run tests.

| Page | What you can do |
|---|---|
| Data Modeling | Preview a foreign-key match, review unmatched sales and duplicate lookup keys, inspect sample joined rows, and approve a new active dataset. Repeat for a third table. |
| Customer Growth | See repeat rate, high-value and overdue customers, observed yearly and seasonal purchases, feedback, editable outreach drafts, and follow-up history. |
| Forecasting | Choose available revenue or units, compare monthly history with estimates, and inspect chronological holdout errors. Long horizons require at least the same length of observed history. |
| AI Business Analyst | Ask for calculated results or retrieve supporting documents. Dataset-scoped hybrid retrieval works locally. Hosted explanations require a configured Groq account. |
| Reports and viewer | Review the past, customer activity, future outlook and actions. Publish an aggregate snapshot with a one-time viewer registration code. Private follow-up tables stay in the admin portal. |

## Update your existing GitHub project

Use the clean source ZIP for this step, before running it, or extract it again to a fresh folder. This example uses a **new clone** at `%USERPROFILE%\insight-ai-release-review` and assumes the release folder is in Downloads. Your existing development folder and deployment stay separate. Sign in to Git through Git Credential Manager if prompted.

```bat
cd /d "%USERPROFILE%"
git clone https://github.com/Shafhere/insight-ai.git insight-ai-release-review
cd insight-ai-release-review
git switch -c feature/customer-growth-forecasting
git status --short
```

The status should be empty. Remove the retired prediction module from this new branch and copy the release into the clone. Use the complete commands below in this newly cloned folder. Robocopy exit codes 0–7 are normally successful.

```bat
git rm -r --ignore-unmatch backend/app/prediction backend/app/api/predictive.py backend/app/schemas/predictive.py backend/tests/test_predictive.py
robocopy "%USERPROFILE%\Downloads\INSIGHT_AI" "." /E /XD .git .venv node_modules dist storage __pycache__ .pytest_cache /XF .env .env.local *.pyc *.db *.sqlite3
git add -A
git diff --cached --stat
git status --short
```

Review the staged files. Run the checks in the Windows guide. Commit and push the feature branch.

```bat
git commit -m "Integrate data modeling, customer growth, hybrid retrieval and forecasting"
git push -u origin feature/customer-growth-forecasting
```

Open the repository on GitHub and choose **Compare & pull request** with base `main`. Review the changes and merge when ready. Existing commits stay in the repository history. Pushing a branch does not update your AWS instance.

## Project walkthrough

- [Interview and execution flow](INTERVIEW_FLOW.md)
- [Code and file map](docs/FILE_MAP.md)
- [Evaluation methods and limits](EVALUATION.md)
- [Verification](TESTING.md)
- [Fashion demo data dictionary](demo/DATA_DICTIONARY.md)
