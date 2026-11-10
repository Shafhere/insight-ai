from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_upload_csv():
    csv_content = (
        b"Product,Sales,Quantity\n"
        b"Laptop,50000,2\n"
        b"Mouse,1000,5\n"
        b"Keyboard,2000,3\n"
    )

    response = client.post(
        "/api/v1/datasets/upload",
        files={
            "file": (
                "sales.csv",
                csv_content,
                "text/csv",
            )
        },
    )

    assert response.status_code == 200

    result = response.json()["dataset"]

    assert result["rows"] == 3
    assert result["columns"] == 3
    assert result["detected_domain"] == "retail"
    assert result["quality_score"] == 100


def test_reject_unsupported_file():
    response = client.post(
        "/api/v1/datasets/upload",
        files={
            "file": (
                "example.txt",
                b"some text",
                "text/plain",
            )
        },
    )

    assert response.status_code == 400