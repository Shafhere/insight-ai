from sqlalchemy import create_engine

from app.auth import store as auth_store


def test_report_code_is_one_time_and_viewer_is_scoped(tmp_path, monkeypatch):
    database = tmp_path / "portal-test.sqlite3"
    engine = create_engine(f"sqlite:///{database}", connect_args={"check_same_thread": False})
    monkeypatch.setattr(auth_store, "engine", engine)
    auth_store.init_auth_store()

    published = auth_store.create_published_report(
        "dataset-123", "Quarterly report", {"overview": {"rows": 25}}, expires_days=7
    )
    viewer = auth_store.create_viewer(
        "Test Viewer", "viewer@example.com", "SecurePass123", published["access_code"]
    )

    assert viewer["role"] == "viewer"
    assert auth_store.list_user_reports(viewer["id"])[0]["id"] == published["report_id"]
    assert auth_store.get_user_report(viewer["id"], published["report_id"])["payload"]["overview"]["rows"] == 25

    try:
        auth_store.create_viewer("Second Viewer", "second@example.com", "SecurePass456", published["access_code"])
    except Exception as exc:
        assert "invalid" in str(exc).lower() or "already used" in str(exc).lower()
    else:
        raise AssertionError("A redeemed report access code must not be reusable")


def test_viewer_preferences_are_persisted(tmp_path, monkeypatch):
    database = tmp_path / "preferences-test.sqlite3"
    engine = create_engine(f"sqlite:///{database}", connect_args={"check_same_thread": False})
    monkeypatch.setattr(auth_store, "engine", engine)
    auth_store.init_auth_store()
    viewer = auth_store.create_viewer(
        "Preference User", "prefs@example.com", "SecurePass789",
        auth_store.create_published_report("ds", "Prefs report", {}, 7)["access_code"],
    )
    expected = {"chartTypes": {"revenue": "area", "category": "pie"}}
    auth_store.save_viewer_preferences(viewer["id"], expected)
    assert auth_store.get_viewer_preferences(viewer["id"]) == expected
