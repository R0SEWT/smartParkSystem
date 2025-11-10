import os
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
import psycopg
from psycopg_pool import ConnectionPool
from models import SensorEvent, OccupancyPoint

import certifi
from pymongo import MongoClient


# ---- Config (Key Vault References en Azure inyectan variables) ----
PG_CONN = os.environ.get("PG_CONN")
MONGODB_URI = os.environ.get("MONGODB_URI")

if not PG_CONN:
    raise RuntimeError("PG_CONN no está configurado")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI no está configurado")

# ---- Postgres Pool ----
pg_pool = ConnectionPool(PG_CONN, min_size=1, max_size=6, kwargs={"autocommit": True})

# ---- Mongo Client ----
mongo = MongoClient(MONGODB_URI, tlsCAFile=certifi.where(), connectTimeoutMS=20000, serverSelectionTimeoutMS=20000)

mdb = mongo["smartpark"]
col_events_raw = mdb["events_raw"]
col_meta_sensors = mdb["sensors_meta"]  # opcional para metadata por sensor


# ---- Crear índices si no existen (idempotente) ----
def _ensure_mongo_indexes():
    try:
        col_events_raw.create_index([("sensor_id", ASCENDING), ("ts", DESCENDING)], name="sid_ts")
        col_events_raw.create_index([("ts", DESCENDING)], name="ts_desc")
    except PyMongoError as e:
        print(f"[WARN] creando índices mongo: {e}")


_ensure_mongo_indexes()

app = Flask(__name__)


# ---- Utilidades PG ----
def pg_exec(sql: str, params=None):
    with pg_pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)


def pg_fetchall(sql: str, params=None):
    with pg_pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


# ---- Rutas ----
@app.get("/healthzdb")
def healthzdb():
    pg_ok = False
    mongo_ok = False
    errors = {}

    # PG
    try:
        pg_fetchall("SELECT 1;")
        pg_ok = True
    except Exception as e:
        errors["postgres"] = str(e)

    # MONGO
    try:
        mongo.admin.command("ping")
        mongo_ok = True
    except Exception as e:
        errors["mongo"] = str(e)

    ok = pg_ok and mongo_ok
    status = 200 if ok else 503   # importante: NO 500 → 503 = service unavailable

    return jsonify({
        "ok": ok,
        "postgres": pg_ok,
        "mongo": mongo_ok,
        "errors": errors if not ok else None
    }), status


@app.get("/healthz")
def healthz():
    return {"ok": True}



@app.post("/sensor_event")
def sensor_event():
    # Validación de payload (Pydantic)
    try:
        data = SensorEvent(**request.get_json(force=True))
    except Exception as e:
        return jsonify({"ok": False, "error": f"payload inválido: {e}"}), 400

    ts = data.ts or datetime.utcnow()
    doc = {
        "sensor_id": data.sensor_id,
        "occupied": data.occupied,
        "ts": ts,
        "payload": data.payload or {}
    }

    # 1) Inserta crudo en Mongo
    try:
        col_events_raw.insert_one(doc)
    except PyMongoError as e:
        return jsonify({"ok": False, "error": f"mongo insert: {e}"}), 502

    # 2) Normaliza en Postgres
    try:
        pg_exec(
            "INSERT INTO events(sensor_id, ts, occupied, payload_jsonb) VALUES (%s, %s, %s, %s)",
            (data.sensor_id, ts, data.occupied, json.dumps(doc["payload"]))
        )
    except Exception as e:
        return jsonify({"ok": False, "error": f"pg insert: {e}"}), 502

    return jsonify({"ok": True, "ts": ts.isoformat()}), 201


@app.post("/occupancy_point")
def occupancy_point():
    try:
        op = OccupancyPoint(**request.get_json(force=True))
    except Exception as e:
        return jsonify({"ok": False, "error": f"payload inválido: {e}"}), 400

    ts = op.ts or datetime.utcnow()
    try:
        pg_exec(
            "INSERT INTO occupancy(lot_id, ts, occupied_spaces, total_spaces) VALUES (%s, %s, %s, %s)",
            (op.lot_id, ts, op.occupied_spaces, op.total_spaces)
        )
        return jsonify({"ok": True}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": f"pg insert occupancy: {e}"}), 502


@app.get("/status_overview")
def status_overview():
    try:
        last_events = list(
            col_events_raw.find({}, {"_id": 0})
            .sort("ts", DESCENDING)
            .limit(5)
        )
    except PyMongoError as e:
        last_events = []
        print(f"[WARN] mongo read: {e}")

    try:
        rows = pg_fetchall("""
            SELECT lot_id, ts, occupied_spaces, total_spaces
            FROM occupancy
            ORDER BY ts DESC
            LIMIT 5;
        """)
        occ = [
            {"lot_id": r[0], "ts": r[1].isoformat(), "occupied": r[2], "total": r[3]}
            for r in rows
        ]
    except Exception as e:
        occ = []
        print(f"[WARN] pg read: {e}")

    return jsonify({"last_events": last_events, "occupancy": occ})


# ---- Entry ----
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)
