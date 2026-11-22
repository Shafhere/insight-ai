"""Agent 1: profile an uploaded dataset and prepare a safe analysis plan."""


def profile_uploaded_dataset(file_path, dataset_id: str, original_filename: str):
    """Create and persist the dataset profile immediately after upload.

    Profiling is deterministic Python work; the LLM is not asked to invent
    schema, row counts, missing-value counts, or data types.
    """
    from app.data.dataset_service import analyse_saved_dataset

    return analyse_saved_dataset(
        file_path=file_path,
        dataset_id=dataset_id,
        original_filename=original_filename,
    )


def run(state: dict) -> dict:
    """Use the saved profile/schema to validate a natural-language plan."""
    from app.agents.workflow import plan_question

    return plan_question(state)


def feature_readiness(dataset_id):
    """Report concrete evidence for each page before a user opens it."""
    from app.agents.business_evidence import workspace_outlook, workspace_growth, folder_for
    import json

    growth = workspace_growth(dataset_id)
    forecast = workspace_outlook(dataset_id)
    path = folder_for(dataset_id) / "relationships.json"
    relationship = json.loads(path.read_text()) if path.exists() else {}
    return {
        "Analytics": "Active dataset profiled.",
        "Data Modeling": (f"{relationship['sales_name']} joined to {relationship['lookup_name']} on "
                          f"{relationship['left']} → {relationship['right']}. {relationship['matched']} matched sales rows."
                          if relationship else "Upload a lookup table to inspect potential relationships."),
        "Customer Growth": growth.get("reason") or f"{growth['customers']} identified buyers with dated purchases.",
        "Customer Feedback": f"{growth['feedback']['ratings']} usable ratings." if growth.get("feedback") else "Upload ratings in Customer Growth.",
        "Forecasting": forecast.get("reason") or f"{forecast['observed_periods']} monthly observations of {forecast['value_column']}.",
    }
