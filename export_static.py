import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "tw_cn_hk_mo_routes.sqlite"
DATA_DIR = ROOT / "web" / "data"

DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DAY_LABELS = {
    "Mon": "週一",
    "Tue": "週二",
    "Wed": "週三",
    "Thu": "週四",
    "Fri": "週五",
    "Sat": "週六",
    "Sun": "週日",
}


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def rows_to_dicts(rows):
    return [dict(row) for row in rows]


def write_json(name, payload):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / name
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def build_options(conn):
    airlines = [
        row["airline"]
        for row in conn.execute("SELECT DISTINCT airline FROM flights ORDER BY airline")
    ]
    airports = [
        row["airport"]
        for row in conn.execute(
            """
            SELECT departure_airport AS airport FROM flights
            UNION
            SELECT arrival_airport AS airport FROM flights
            ORDER BY airport
            """
        )
    ]
    cities = [
        row["city_region"]
        for row in conn.execute("SELECT DISTINCT city_region FROM flights ORDER BY city_region")
    ]
    statuses = [
        row["verification_status"]
        for row in conn.execute(
            "SELECT DISTINCT verification_status FROM flights ORDER BY verification_status"
        )
    ]
    return {
        "airlines": airlines,
        "airports": airports,
        "cities": cities,
        "statuses": statuses,
        "days": [{"value": day, "label": DAY_LABELS[day]} for day in DAY_ORDER],
        "sorts": [
            {"value": "departure_time", "label": "起飛時間"},
            {"value": "airline", "label": "航空公司"},
            {"value": "route", "label": "航線"},
        ],
    }


def build_health(conn):
    total = conn.execute("SELECT COUNT(*) AS total FROM flights").fetchone()["total"]
    airline_counts = rows_to_dicts(
        conn.execute(
            """
            SELECT airline, COUNT(*) AS count
            FROM flights
            GROUP BY airline
            ORDER BY airline
            """
        ).fetchall()
    )
    status_counts = rows_to_dicts(
        conn.execute(
            """
            SELECT verification_status AS status, COUNT(*) AS count
            FROM flights
            GROUP BY verification_status
            ORDER BY verification_status
            """
        ).fetchall()
    )
    source_checks = rows_to_dicts(
        conn.execute("SELECT * FROM source_checks ORDER BY airline").fetchall()
    )
    route_integrity = rows_to_dicts(
        conn.execute(
            """
            SELECT * FROM route_integrity_checks
            ORDER BY status DESC, route_pair
            """
        ).fetchall()
    )
    airline_route_integrity = rows_to_dicts(
        conn.execute(
            """
            SELECT * FROM airline_route_integrity_checks
            ORDER BY status DESC, airline, route_pair
            """
        ).fetchall()
    )
    return {
        "database": DB_PATH.name,
        "total_flights": total,
        "airline_counts": airline_counts,
        "status_counts": status_counts,
        "source_checks": source_checks,
        "route_integrity_checks": route_integrity,
        "airline_route_integrity_checks": airline_route_integrity,
    }


def main():
    if not DB_PATH.exists():
        raise SystemExit(f"找不到資料庫：{DB_PATH}")

    with connect() as conn:
        flights = rows_to_dicts(conn.execute("SELECT * FROM flights ORDER BY id").fetchall())
        options = build_options(conn)
        health = build_health(conn)

    outputs = [
        write_json("flights.json", {"flights": flights}),
        write_json("options.json", options),
        write_json("health.json", health),
    ]
    for path in outputs:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
