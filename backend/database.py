"""
Database service — SQLite persistence for patients, screenings, and statistics.
"""

import os
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "retina_ai.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables if they do not exist."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Patients table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER,
                gender TEXT,
                patient_id TEXT,
                contact TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # Screenings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS screenings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER,
                prediction TEXT NOT NULL,
                class_id INTEGER NOT NULL,
                confidence REAL NOT NULL,
                heatmap_url TEXT,
                overlay_url TEXT,
                explanation TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (patient_id) REFERENCES patients (id)
            )
        """)

        conn.commit()
    print(f"Database initialized at {DB_PATH}")


def save_screening(
    name: str,
    age: int | None,
    gender: str | None,
    patient_id_str: str | None,
    contact: str | None,
    prediction: str,
    class_id: int,
    confidence: float,
    heatmap_url: str,
    overlay_url: str,
    explanation: str,
) -> dict:
    """Save a patient and screening record to SQLite."""
    now_str = datetime.now().strftime("%d %b %Y, %H:%M")
    date_short = datetime.now().strftime("%d %b %Y")

    with get_connection() as conn:
        cursor = conn.cursor()

        # Insert patient
        cursor.execute(
            """
            INSERT INTO patients (name, age, gender, patient_id, contact, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                name or "Anonymous Patient",
                age,
                gender or "Unspecified",
                patient_id_str or f"P-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                contact or "",
                now_str,
            ),
        )
        patient_row_id = cursor.lastrowid

        # Insert screening
        cursor.execute(
            """
            INSERT INTO screenings (patient_id, prediction, class_id, confidence, heatmap_url, overlay_url, explanation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_row_id,
                prediction,
                class_id,
                confidence,
                heatmap_url,
                overlay_url,
                explanation,
                now_str,
            ),
        )
        screening_row_id = cursor.lastrowid
        conn.commit()

    return {
        "id": screening_row_id,
        "patient": {
            "id": patient_row_id,
            "name": name or "Anonymous Patient",
            "age": age,
            "gender": gender or "Unspecified",
            "patient_id": patient_id_str or f"P-{patient_row_id:04d}",
            "contact": contact or "",
        },
        "prediction": prediction,
        "class_id": class_id,
        "confidence": confidence,
        "heatmap_url": heatmap_url,
        "overlay_url": overlay_url,
        "explanation": explanation,
        "date": date_short,
        "created_at": now_str,
    }


def update_screening_assets(
    screening_id: int,
    heatmap_url: str | None = None,
    overlay_url: str | None = None,
    explanation: str | None = None,
) -> bool:
    """Update visualization assets after the prediction response has returned."""
    fields = []
    values = []

    if heatmap_url is not None:
        fields.append("heatmap_url = ?")
        values.append(heatmap_url)
    if overlay_url is not None:
        fields.append("overlay_url = ?")
        values.append(overlay_url)
    if explanation is not None:
        fields.append("explanation = ?")
        values.append(explanation)

    if not fields:
        return False

    values.append(screening_id)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE screenings SET {', '.join(fields)} WHERE id = ?",
            values,
        )
        conn.commit()
        return cursor.rowcount > 0


def get_all_screenings() -> list:
    """Get all screenings with patient details."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                s.id as screening_id,
                s.prediction,
                s.class_id,
                s.confidence,
                s.heatmap_url,
                s.overlay_url,
                s.explanation,
                s.created_at,
                p.id as patient_db_id,
                p.name as patient_name,
                p.age as patient_age,
                p.gender as patient_gender,
                p.patient_id as patient_code,
                p.contact as patient_contact
            FROM screenings s
            LEFT JOIN patients p ON s.patient_id = p.id
            ORDER BY s.id DESC
        """)
        rows = cursor.fetchall()

    results = []
    for r in rows:
        results.append({
            "id": r["screening_id"],
            "patient_name": r["patient_name"] or "Anonymous Patient",
            "patient_age": r["patient_age"],
            "patient_gender": r["patient_gender"],
            "patient_id": r["patient_code"],
            "patient_contact": r["patient_contact"],
            "prediction": r["prediction"],
            "class_id": r["class_id"],
            "confidence": r["confidence"],
            "heatmap_url": r["heatmap_url"],
            "overlay_url": r["overlay_url"],
            "explanation": r["explanation"],
            "date": r["created_at"],
            "status": "Screened" if r["class_id"] == 0 else "Review recommended",
        })
    return results


def get_recent_screenings(limit: int = 5) -> list:
    """Get N most recent screenings."""
    all_records = get_all_screenings()
    return all_records[:limit]


def get_dashboard_stats() -> dict:
    """Get count of total patients, total screenings, and today's screenings."""
    today_prefix = datetime.now().strftime("%d %b %Y")
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM patients")
        total_patients = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM screenings")
        total_screenings = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM screenings WHERE created_at LIKE ?", (f"{today_prefix}%",))
        today_screenings = cursor.fetchone()[0]

    return {
        "total_patients": total_patients,
        "total_screenings": total_screenings,
        "today_screenings": today_screenings,
    }


def get_screening_distribution() -> dict:
    """Get count of screenings per class."""
    classes = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
    dist = {c: 0 for c in classes}

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT prediction, COUNT(*) as cnt FROM screenings GROUP BY prediction")
        rows = cursor.fetchall()
        for r in rows:
            if r["prediction"] in dist:
                dist[r["prediction"]] = r["cnt"]

    return dist
