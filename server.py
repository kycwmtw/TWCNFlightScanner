from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import json
import os
import sqlite3


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "tw_cn_hk_mo_routes.sqlite"
WEB_ROOT = ROOT / "web"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))


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


def get_param(params, name):
    values = params.get(name, [""])
    return values[0].strip()


def query_flights(params):
    where = []
    values = []

    filters = {
        "airline": "airline = ?",
        "departure_airport": "departure_airport = ?",
        "arrival_airport": "arrival_airport = ?",
        "city_region": "city_region = ?",
        "verification_status": "verification_status = ?",
    }

    for name, clause in filters.items():
        value = get_param(params, name)
        if value:
            where.append(clause)
            values.append(value)

    day = get_param(params, "day")
    if day:
        where.append("flight_days LIKE ?")
        values.append(f"%{day}%")

    q = get_param(params, "q")
    if q:
        like = f"%{q}%"
        where.append(
            """(
                flight_number LIKE ?
                OR airline LIKE ?
                OR departure_airport LIKE ?
                OR arrival_airport LIKE ?
                OR city_region LIKE ?
                OR aircraft LIKE ?
            )"""
        )
        values.extend([like] * 6)

    sort = get_param(params, "sort") or "departure_time"
    sort_sql = {
        "departure_time": "departure_time, airline, flight_number",
        "airline": "airline, flight_number, departure_time",
        "route": "departure_airport, arrival_airport, departure_time",
    }.get(sort, "departure_time, airline, flight_number")

    sql = "SELECT * FROM flights"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {sort_sql}"

    with connect() as conn:
        return rows_to_dicts(conn.execute(sql, values).fetchall())


def query_options():
    with connect() as conn:
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
            for row in conn.execute(
                "SELECT DISTINCT city_region FROM flights ORDER BY city_region"
            )
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


def query_health():
    with connect() as conn:
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

    return {
        "database": DB_PATH.name,
        "total_flights": total,
        "airline_counts": airline_counts,
        "status_counts": status_counts,
        "source_checks": source_checks,
        "route_integrity_checks": route_integrity,
    }


class RouteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        try:
            if parsed.path == "/api/flights":
                self.send_json({"flights": query_flights(params)})
                return
            if parsed.path == "/api/options":
                self.send_json(query_options())
                return
            if parsed.path == "/api/health":
                self.send_json(query_health())
                return
            if parsed.path == "/":
                self.path = "/index.html"
        except sqlite3.Error as exc:
            self.send_json({"error": str(exc)}, status=500)
            return

        super().do_GET()


def main():
    if not DB_PATH.exists():
        raise SystemExit(f"找不到資料庫：{DB_PATH}")
    if not WEB_ROOT.exists():
        raise SystemExit(f"找不到網頁目錄：{WEB_ROOT}")

    server = ThreadingHTTPServer((HOST, PORT), RouteHandler)
    print(f"航線查詢工具已啟動：http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
