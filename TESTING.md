# Release verification

The backend suite passed all **81 tests** using a fresh Python 3.12 virtual environment on Linux with the development requirements installed. The React production build completed after npm ci. Vite reported a bundle-size advisory. The Python suite reported a pandas/NumPy deprecation warning.

## Verified flows

- Uploaded the original 15,000-line fashion sales file, approved cleaning, joined the 2,600-customer directory by customer ID, and joined the 165-product master by SKU. The active model kept all 15,000 sales lines.
- Attached the 750-row feedback file, loaded the private customer table, recorded a follow-up and generated a 36-month forecast.
- Queried customer evidence, retrieved dataset-scoped documents, previewed and published a report, registered a viewer and compared the frozen forecast and customer totals with the admin results. A viewer request to the private customer endpoint returned HTTP 403.
- Exercised the React interface in Chromium with a smaller sample of the fashion sales. The browser signed in, uploaded data, previewed and approved a join, opened Customer Growth, changed the theme, opened Forecasting, and published. An authenticated viewer opened Customer Growth and the Future report page. The browser recorded no page exceptions in that run.
- Tested separate-key handling, ambiguous joins, historical season gaps, distinct orders on multi-line bills and retained leading zeroes in CSV identifiers.

## Numbers to check in the demo

Using the supplied sales CSV as uploaded, through October 31, 2026, there are **2,011 identified buyers** and **1,508 repeat buyers**. Under the personal-gap rule, **666** qualify for review. Another **757** sales lines lack a usable customer ID. The 2,600 rows in the customer directory include people without identified purchases during the sales history.

The default net-sales series has 46 monthly observations. For the 36-month outlook, the linear trend had a holdout MAE of approximately ₹94,039 and WAPE of 14.01%. These are historical validation measurements for this file. A four-year horizon needs at least 48 observed months.

## What still needs a local check

The Windows commands are provided in START_HERE_WINDOWS.md. The verification host ran Linux. Live Groq answers, optional MiniLM/Chroma downloads, Celery/Redis, Docker and an AWS deployment were outside the verified demo. Test the live provider with your own credentials. The default local hybrid mode and the deterministic evidence routes require no provider credentials. A browser smoke test covers the demonstrated screens; it is not a pixel-level accessibility audit.
