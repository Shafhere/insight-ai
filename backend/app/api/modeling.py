import uuid
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.config import settings
from app.analytics.service import load_analytics_dataset
from app.analytics.customer_growth import customer_growth
from app.agents.business_evidence import workspace_growth, workspace_outlook
from app.data.modeling import relationships, inspect, join_tables
from app.data.dataset_service import analyse_saved_dataset, get_dataset_profile

router = APIRouter(prefix="/datasets", tags=["Modeling and growth"])


class Join(BaseModel):
    lookup: uuid.UUID
    left: str = ""
    right: str = ""
    apply: bool = False


@router.post("/{dataset_id}/model")
def model(dataset_id: uuid.UUID, body: Join):
    try:
        sales = load_analytics_dataset(str(dataset_id))
        lookup = load_analytics_dataset(str(body.lookup))
        if not body.left or not body.right:
            return {
                "sales_name": get_dataset_profile(str(dataset_id)).filename,
                "lookup_name": get_dataset_profile(str(body.lookup)).filename,
                "sales_rows": len(sales),
                "lookup_rows": len(lookup),
                "candidates": relationships(sales, lookup),
                "left_columns": list(sales),
                "right_columns": list(lookup),
            }
        check = inspect(sales, lookup, body.left, body.right)
        if not body.apply:
            if check["safe"]:
                merged = join_tables(sales, lookup, body.left, body.right)
                extra = [c for c in merged if c not in sales]
                check.update(
                    {
                        "preview": json.loads(
                            merged[[body.left, *extra[:5]]].head(5).to_json(orient="records")
                        ),
                        "added_columns": extra,
                        "output_rows": len(merged),
                    }
                )
            return check
        merged = join_tables(sales, lookup, body.left, body.right)
        check.update(
            {
                "sales_name": get_dataset_profile(str(dataset_id)).filename,
                "lookup_name": get_dataset_profile(str(body.lookup)).filename,
                "added_columns": [c for c in merged if c not in sales],
                "output_rows": len(merged),
            }
        )
        ident = str(uuid.uuid4())
        folder = settings.storage_dir / ident
        folder.mkdir()
        path = folder / "original.csv"
        merged.to_csv(path, index=False)
        profile = analyse_saved_dataset(path, ident, "Modeled sales.csv")
        (folder / "relationships.json").write_text(
            json.dumps({"sales": str(dataset_id), "lookup": str(body.lookup), **check})
        )
        return profile
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/{dataset_id}/growth")
def growth(dataset_id: uuid.UUID):
    return workspace_growth(str(dataset_id), private=True)


@router.get("/{dataset_id}/outlook")
def forecast(dataset_id: uuid.UUID, horizon: int | None = None, metric: str | None = None):
    return workspace_outlook(str(dataset_id), horizon, metric)


def save_setting(dataset_id, name, value):
    folder = settings.storage_dir / str(dataset_id)
    if not (folder / "profile.json").is_file():
        raise HTTPException(404, "Dataset not found.")
    temp = folder / str(uuid.uuid4())
    temp.write_text(str(value))
    temp.replace(folder / name)


@router.put("/{dataset_id}/customer-source/{source_id}")
def attach_customer_history(dataset_id: uuid.UUID, source_id: uuid.UUID):
    result = customer_growth(load_analytics_dataset(str(source_id)))
    if "reason" in result:
        raise HTTPException(422, result["reason"])
    save_setting(dataset_id, "customer_source.txt", source_id)
    return result


@router.put("/{dataset_id}/outlook/{horizon}")
def choose_outlook(dataset_id: uuid.UUID, horizon: int, metric: str | None = None):
    result = forecast(dataset_id, horizon, metric)
    if "reason" in result:
        raise HTTPException(422, result["reason"])
    save_setting(
        dataset_id,
        "forecast_settings.json",
        json.dumps({"horizon": horizon, "metric": result["value_column"]}),
    )
    return result


class FollowUp(BaseModel):
    customer: str = Field(min_length=1, max_length=200)
    status: str


@router.post("/{dataset_id}/follow-up")
def follow_up(dataset_id: uuid.UUID, body: FollowUp):
    from app.analytics.engagement import record

    try:
        record(dataset_id, body.customer, body.status)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"status": body.status}


@router.put("/{dataset_id}/feedback/{source_id}")
def attach_feedback(dataset_id: uuid.UUID, source_id: uuid.UUID):
    from app.analytics.engagement import feedback_summary

    try:
        summary = feedback_summary(load_analytics_dataset(str(source_id)))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    save_setting(dataset_id, "feedback.txt", source_id)
    return summary


@router.get("/{dataset_id}/readiness")
def readiness(dataset_id: uuid.UUID):
    from app.agents.agent_01_data_profile import feature_readiness

    return feature_readiness(str(dataset_id))
