"""Run deterministic synthetic smoke evaluations for ML and forecasting."""
from pathlib import Path
import sys
import tempfile

# Allow `python scripts/run_evaluation.py` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd


from app.forecasting.service import forecast_series


def main() -> None:
    rng = np.random.default_rng(42)
    dates = pd.date_range("2022-01-01", periods=36, freq="MS")
    demand = pd.DataFrame({"date": dates, "units": 100 + np.arange(36) * 2 + rng.normal(0, 3, 36)})
    forecast = forecast_series(demand, "date", "units", horizon=4)
    print("\nFORECAST measured results")
    print({"method": forecast["selected_method"], "backtest": forecast["backtest_metrics"], "forecasts": forecast["forecasts"]})


if __name__ == "__main__":
    main()
