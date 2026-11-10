"""Run deterministic synthetic smoke evaluations for ML and forecasting."""
from pathlib import Path
import sys
import tempfile

# Allow `python scripts/run_evaluation.py` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd

from app.prediction.model_engine import train_model
from app.prediction.forecasting import forecast_series


def main() -> None:
    rng = np.random.default_rng(42)
    rows = 240
    x = rng.normal(size=rows)
    segment = rng.choice(["north", "south", "west"], size=rows)
    regression = pd.DataFrame({"signal": x, "segment": segment, "target": 12 + 3 * x + rng.normal(0, 0.4, rows)})
    classification = pd.DataFrame({"signal": x, "segment": segment, "target": np.where(x > 0, "high", "low")})
    with tempfile.TemporaryDirectory() as temp:
        for label, frame, task in [("regression", regression, "regression"), ("classification", classification, "classification")]:
            result = train_model(frame, "target", Path(temp) / f"{label}.joblib", task)
            print(f"\n{label.upper()} measured results")
            print({"model": result["model_name"], "holdout": result["metrics"], "baseline": result["baseline_metrics"], "beats_baseline": result["beats_baseline"]})
    dates = pd.date_range("2022-01-01", periods=36, freq="MS")
    demand = pd.DataFrame({"date": dates, "units": 100 + np.arange(36) * 2 + rng.normal(0, 3, 36)})
    forecast = forecast_series(demand, "date", "units", horizon=4)
    print("\nFORECAST measured results")
    print({"method": forecast["selected_method"], "backtest": forecast["backtest_metrics"], "forecasts": forecast["forecasts"]})


if __name__ == "__main__":
    main()
