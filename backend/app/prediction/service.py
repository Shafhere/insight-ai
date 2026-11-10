import pandas as pd

from app.prediction.model_engine import (
    predict_saved_model,
    train_model,
)
from app.schemas.predictive import (
    PredictionResponse,
    PredictiveReport,
)
from app.analytics.service import load_analytics_dataset, prepare_business_dataframe, get_semantic_columns
from app.cleaning import get_original_file


def run_prediction(
    dataset_id: str,
    target_column: str,
    source: str = "original",
    task: str = "auto",
) -> PredictiveReport:
    raw_dataframe = load_analytics_dataset(dataset_id, source)
    dataframe = prepare_business_dataframe(raw_dataframe, get_semantic_columns(dataset_id))

    dataset_folder = get_original_file(dataset_id).parent
    model_path = dataset_folder / "predictive_model.joblib"

    result = train_model(
        dataframe=dataframe,
        target_column=target_column,
        model_path=model_path,
        task=task,
    )

    return PredictiveReport(
        dataset_id=dataset_id,
        **result,
    )


def run_saved_model_prediction(
    dataset_id: str,
    records: list[dict],
) -> PredictionResponse:
    """Load the saved model and predict new records."""
    dataset_folder = get_original_file(dataset_id).parent
    model_path = dataset_folder / "predictive_model.joblib"

    dataframe = pd.DataFrame(records)

    predictions = predict_saved_model(
        dataframe=dataframe,
        model_path=model_path,
    )

    return PredictionResponse(
        dataset_id=dataset_id,
        prediction_count=len(predictions),
        predictions=predictions,
    )