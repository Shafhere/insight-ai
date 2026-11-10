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
