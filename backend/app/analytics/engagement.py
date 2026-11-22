"""Private follow-up log and aggregate feedback. Each workspace owns its log."""

import sqlite3
from datetime import datetime, timezone
from uuid import UUID
from contextlib import closing
import pandas as pd
from app.config import settings
from app.analytics.customer_growth import field

STATUSES = (
    "Follow-up planned",
    "Contacted",
    "No response",
    "Customer responded",
    "Customer purchased again",
    "Closed",
)


def database(dataset_id):
    folder = settings.storage_dir / str(UUID(str(dataset_id)))
    db = sqlite3.connect(folder / "engagement.sqlite3")
    db.execute("CREATE TABLE IF NOT EXISTS events (customer TEXT, status TEXT, recorded TEXT)")
    return db


def record(dataset_id, customer, status):
    if status not in STATUSES:
        raise ValueError("Choose a supported follow-up status.")
    with closing(database(dataset_id)) as db, db:
        db.execute(
            "INSERT INTO events VALUES (?,?,?)",
            (customer, status, datetime.now(timezone.utc).isoformat()),
        )


def tracking(dataset_id, rows):
    with closing(database(dataset_id)) as db:
        events = db.execute("SELECT customer,status,recorded FROM events ORDER BY rowid").fetchall()
    latest, contacted = {}, {}
    for customer, status, date in events:
        latest[customer] = status
        if status == "Contacted":
            contacted[customer] = date[:10]
    for row in rows:
        key = row["customer"]
        row["status"] = latest.get(key, "")
        row["purchase_after_contact"] = key in contacted and row["last_purchase"] > contacted[key]
    return {
        "contacted": len(contacted),
        "later_purchases": sum(r["purchase_after_contact"] for r in rows),
    }


def feedback_summary(frame):
    rating = field(frame, "rating_1_to_5", "rating", "stars")
    topic = field(frame, "feedback_topic", "complaint_category", "topic")
    if not rating:
        raise ValueError("Feedback needs a rating column on a 1–5 scale.")
    scores = pd.to_numeric(frame[rating], errors="coerce")
    valid = scores.between(1, 5)
    if not valid.any():
        raise ValueError("No valid ratings between 1 and 5.")
    date = field(frame, "feedback_date", "date")
    trend = {}
    if date:
        months = pd.to_datetime(frame[date], errors="coerce", utc=True).dt.strftime("%Y-%m")
        trend = scores[valid].groupby(months[valid]).mean().round(2).to_dict()
    return {
        "trend": trend,
        "average": round(float(scores[valid].mean()), 2),
        "ratings": int(valid.sum()),
        "distribution": scores[valid].value_counts().sort_index().to_dict(),
        "low_rating_topics": frame.loc[valid & (scores <= 2), topic]
        .value_counts()
        .head(5)
        .to_dict()
        if topic
        else {},
    }
