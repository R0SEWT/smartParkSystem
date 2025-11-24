"""
Simulador de eventos: envía bursts a /sensor_event
Uso: export $(grep -v '^#' tools/.env | xargs) ; python tools/simulator.py
Config:
  API_BASE=http://localhost:8080
  SIM_EST=EST-001            # estacionamiento objetivo
  SIM_SENSOR_IDS=1001,1002   # opcional, lista explícita
  PG_CONN=...                # opcional, para obtener sensores desde la DB
  SIM_PERIOD=2.0             # segundos entre eventos
"""
import json
import os
import random
import time
from datetime import datetime, timezone
import urllib.request

import psycopg
from psycopg.rows import dict_row

API_BASE = os.environ.get("API_BASE", "http://localhost:8080")
ESTACIONAMIENTO = os.environ.get("SIM_EST", "EST-001")
SIM_SENSOR_IDS = os.environ.get("SIM_SENSOR_IDS")
PERIOD_SEC = float(os.environ.get("SIM_PERIOD", "2.0"))
PG_CONN = os.environ.get("PG_CONN")  # opcional


def post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.read()


def load_sensor_ids():
    if SIM_SENSOR_IDS:
        return [int(x.strip()) for x in SIM_SENSOR_IDS.split(",") if x.strip()]

    if PG_CONN:
        with psycopg.connect(PG_CONN, row_factory=dict_row) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM sensor WHERE estacionamiento_id = %s;", (ESTACIONAMIENTO,))
            rows = cur.fetchall()
            if not rows:
                raise RuntimeError(f"No se encontraron sensores para {ESTACIONAMIENTO}")
            return [row["id"] for row in rows]

    raise RuntimeError("Define SIM_SENSOR_IDS o PG_CONN para cargar sensores.")


def main():
    sensor_ids = load_sensor_ids()
    print(f"Simulando {len(sensor_ids)} sensores contra {API_BASE} en {ESTACIONAMIENTO}")

    while True:
        now = datetime.now(tz=timezone.utc).isoformat()
        sid = random.choice(sensor_ids)
        estado = "ocupado" if random.random() < 0.5 else "libre"
        payload = {
            "sensor_id": sid,
            "estacionamiento_id": ESTACIONAMIENTO,
            "estado": estado,
            "ts": now,
            "payload": {"bateria": round(random.uniform(3.3, 4.1), 2)}
        }
        try:
            post("/sensor_event", payload)
        except Exception as e:
            print(f"[WARN] fallo POST: {e}")
        time.sleep(PERIOD_SEC)


if __name__ == "__main__":
    main()
