"""Run the real fashion pack through the same HTTP routes used by the portals."""

import json
import uuid
from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.data.modeling import join_tables
from app.analytics.customer_growth import customer_growth

DEMO = Path(__file__).resolve().parents[2] / "demo"


def test_safe_join_and_overdue_evidence():
    a = pd.DataFrame({"id": ["A", "B"], "amount": [10, 50]})
    with pytest.raises(ValueError):
        join_tables(a, pd.DataFrame({"id": ["A", "A"], "name": ["x", "y"]}), "id", "id")
    b = join_tables(a, pd.DataFrame({"id": ["A"], "name": ["x"]}), "id", "id")
    assert len(b) == 2 and b.amount.sum() == 60 and pd.isna(b.name.iloc[1])
    assert "reason" in customer_growth(a)


def test_fashion_publish_and_viewer(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)
    client = TestClient(app)
    base = "/api/v1"
    admin = client.post(
        base + "/auth/admin-login",
        json={"email": settings.insight_admin_email, "password": settings.insight_admin_password},
    ).json()
    headers = {"Authorization": "Bearer " + admin["access_token"]}

    def call(method, path, **options):
        r = client.request(method, base + path, headers=headers, **options)
        assert r.is_success, r.text[:500]
        return r.json()

    def upload(prefix):
        path = next(DEMO.glob("FASHION_" + prefix + "*.csv"))
        return call(
            "POST", "/datasets/upload", files={"file": (path.name, path.read_bytes(), "text/csv")}
        )["dataset"]["dataset_id"]

    sales = upload("SALES")
    call("POST", f"/datasets/{sales}/cleaning/apply", json={})
    for lookup, key in [("CUSTOMERS", "customer_id"), ("PRODUCTS", "sku")]:
        ident = upload(lookup)
        path = f"/datasets/{sales}/model"
        suggestions = call("POST", path, json={"lookup": ident})
        assert any(c["left"] == key for c in suggestions["candidates"])
        body = {"lookup": ident, "left": key, "right": key}
        check = call("POST", path, json=body)
        assert check["safe"] and check["matched"] + check["unmatched"] == 15000
        result = call("POST", path, json={**body, "apply": True})
        assert result["rows"] == 15000
        sales = result["dataset_id"]
    path = f"/datasets/{sales}"
    call("PUT", path + "/feedback/" + upload("FEEDBACK"))
    growth = call("GET", path + "/growth")
    assert growth["overdue"] > 0 and growth["feedback"]["ratings"] == 750
    row = growth["rows"][0]
    call("POST", path + "/follow-up", json={"customer": row["customer"], "status": "Contacted"})
    future = call("PUT", path + "/outlook/36")
    assert len(future["forecasts"]) == 36
    answer = call(
        "POST", path + "/analyst/ask", json={"question": "How many customers are overdue?"}
    )
    assert str(growth["overdue"]) in answer["answer"] and answer["sources"]
    from app.rag.retrieval import retrieve_documents

    assert (
        retrieve_documents(sales, "customer retention overdue")[0].metadata["dataset_id"] == sales
    )
    preview = call("GET", "/admin/reports/preview/" + sales)
    assert preview["forecast"] == future
    assert preview["customer_growth"]["overdue"] == growth["overdue"]
    assert call("GET", path + "/readiness")["Data Modeling"].startswith("Modeled sales")
    published = call(
        "POST",
        "/admin/reports/publish",
        json={
            "dataset_id": sales,
            "title": "Fashion integration",
            "preview_digest": preview["preview_digest"],
        },
    )
    viewer = client.post(
        base + "/auth/viewer-signup",
        json={
            "name": "Demo Viewer",
            "email": f"{uuid.uuid4()}@example.test",
            "password": "temporary-test",
            "access_code": published["access_code"],
        },
    ).json()
    headers["Authorization"] = "Bearer " + viewer["access_token"]
    assert client.get(base + path + "/growth", headers=headers).status_code == 403
    report = call("GET", "/viewer/reports")["reports"][0]["id"]
    snapshot = call("GET", "/viewer/reports/" + report)["payload"]
    assert (
        snapshot["forecast"] == future
        and snapshot["customer_growth"]["overdue"] == growth["overdue"]
    )
    assert snapshot["customer_growth"]["engagement"]["contacted"] == 1
    encoded = json.dumps(snapshot)
    assert (
        row["name"] not in encoded
        and "DEMO-NON-DIALABLE" not in encoded
        and '"rows": [' not in json.dumps(snapshot["customer_growth"])
    )
    assert call(
        "POST", "/viewer/reports/" + report + "/chat", json={"question": "What is the forecast?"}
    )["answer"]


def test_customer_cadence_and_annual_evidence():
    sales = pd.DataFrame(
        {
            "date": ["2022-08-10", "2023-08-10", "2023-08-10", "2025-09-01"],
            "customer_id": ["007", "007", "007", None],
            "order_id": ["A", "B", "B", "C"],
            "amount": [40, 60, 10, 30],
            "shopping_occasion": ["Onam"] * 4,
        }
    )
    result = customer_growth(sales, private=True)
    row = result["rows"][0]
    assert result["customers"] == 1 and result["overdue"] == 1
    assert row["annual"] == {"2022": 1, "2023": 1, "2024": 0, "2025": 0}
    assert row["spend"] == 110 and row["average_order"] == 55
    assert "no comparable visit" in row["seasonal"][0]


def test_identifier_roundtrip(tmp_path):
    from app.data.ingestion import load_dataset

    path = tmp_path / "lookup.csv"
    path.write_text("customer_id,amount\n007,12\n7,9\n")
    assert list(load_dataset(path)["customer_id"]) == ["007", "7"]
