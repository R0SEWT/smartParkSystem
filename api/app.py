import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
from psycopg_pool import ConnectionPool
from models import SensorEvent
import certifi


# ---- Config (Key Vault References en Azure inyectan variables) ----
PG_CONN = os.environ.get("PG_CONN")
MONGODB_URI = os.environ.get("MONGODB_URI")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

if not PG_CONN:
    raise RuntimeError("PG_CONN no está configurado")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI no está configurado")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

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
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})



OPENAPI_SPEC = {
    "openapi": "3.1.0",
    "info": {"title": "SmartPark API", "version": "1.0.0"},
    "paths": {
        "/healthz": {
            "get": {"summary": "Health simple", "responses": {"200": {"description": "ok"}}}
        },
        "/healthzdb": {
            "get": {
                "summary": "Health DBs",
                "responses": {"200": {"description": "ok"}, "503": {"description": "db error"}}
            }
        },
        "/sensor_event": {
            "post": {
                "summary": "Ingesta de evento de sensor",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "sensor_id": {"type": "integer"},
                                    "estacionamiento_id": {"type": "string"},
                                    "estado": {"type": "string", "enum": ["ocupado", "libre"]},
                                    "ts": {"type": "string", "format": "date-time"},
                                    "payload": {"type": "object"}
                                },
                                "required": ["sensor_id", "estacionamiento_id", "estado"]
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "evento aceptado"}}
            }
        },
        "/status_overview": {
            "get": {
                "summary": "Últimos eventos y registros",
                "responses": {"200": {"description": "ok"}}
            }
        },
        "/registro_data": {
            "get": {
                "summary": "Listar registros normalizados",
                "parameters": [
                    {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 50}},
                    {"name": "estacionamiento_id", "in": "query", "schema": {"type": "string"}},
                    {"name": "sensor_id", "in": "query", "schema": {"type": "integer"}}
                ],
                "responses": {"200": {"description": "ok"}}
            }
        }
    }
}


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
        "estacionamiento_id": data.estacionamiento_id,
        "estado": data.estado,
        "ts": ts,
        "payload": data.payload or {}
    }

    # 1) Inserta crudo en Mongo
    try:
        col_events_raw.insert_one(doc)
    except PyMongoError as e:
        return jsonify({"ok": False, "error": f"mongo insert: {e}"}), 502

    # 2) Normaliza en Postgres
    hora_ocupado = ts if data.estado == "ocupado" else None
    hora_libre = ts if data.estado == "libre" else None
    try:
        pg_exec(
            """
            INSERT INTO registro_data(
              sensor_id, estacionamiento_id, hora_libre, tiempo_libre, hora_ocupado, tiempo_ocupado, estado, created_at
            ) VALUES (%s, %s, %s, NULL, %s, NULL, %s, %s)
            """,
            (data.sensor_id, data.estacionamiento_id, hora_libre, hora_ocupado, data.estado, ts)
        )
    except Exception as e:
        return jsonify({"ok": False, "error": f"pg insert: {e}"}), 502

    return jsonify({"ok": True, "ts": ts.isoformat(), "estado": data.estado}), 201


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
            SELECT sensor_id, estacionamiento_id, estado, hora_libre, hora_ocupado, created_at
            FROM registro_data
            ORDER BY created_at DESC
            LIMIT 5;
        """)
        reg = [
            {
                "sensor_id": r[0],
                "estacionamiento_id": r[1],
                "estado": r[2],
                "hora_libre": r[3].isoformat() if r[3] else None,
                "hora_ocupado": r[4].isoformat() if r[4] else None,
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
    except Exception as e:
        reg = []
        print(f"[WARN] pg read: {e}")

    return jsonify({"last_events": last_events, "registro_data": reg})


@app.get("/registro_data")
def registro_data_list():
    try:
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        return jsonify({"ok": False, "error": "limit debe ser entero"}), 400

    limit = max(1, min(limit, 500))
    estacionamiento_id = request.args.get("estacionamiento_id")
    sensor_id = request.args.get("sensor_id")

    where = []
    params = []
    if estacionamiento_id:
        where.append("estacionamiento_id = %s")
        params.append(estacionamiento_id)
    if sensor_id:
        where.append("sensor_id = %s")
        params.append(int(sensor_id))

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    sql = f"""
        SELECT sensor_id, estacionamiento_id, estado, hora_libre, hora_ocupado, created_at
        FROM registro_data
        {where_sql}
        ORDER BY created_at DESC
        LIMIT %s;
    """
    params.append(limit)

    try:
        rows = pg_fetchall(sql, params)
    except Exception as e:
        return jsonify({"ok": False, "error": f"pg query: {e}"}), 502

    reg = [
        {
            "sensor_id": r[0],
            "estacionamiento_id": r[1],
            "estado": r[2],
            "hora_libre": r[3].isoformat() if r[3] else None,
            "hora_ocupado": r[4].isoformat() if r[4] else None,
            "created_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]
    return jsonify({"ok": True, "count": len(reg), "items": reg})


@app.get("/openapi.json")
def openapi_json():
    return jsonify(OPENAPI_SPEC)


@app.get("/docs")
def swagger_ui():
    html = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <title>SmartPark API Docs</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => {{
            SwaggerUIBundle({{
              url: "/openapi.json",
              dom_id: '#swagger-ui'
            }});
          }};
        </script>
      </body>
    </html>
    """
    return html


# ---- Entry ----
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)
