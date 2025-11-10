"""
Simulador de eventos: envía bursts a /sensor_event
Uso: export $(grep -v '^#' tools/.env | xargs) ; python tools/simulator.py
"""
import json
import os
import random
import time
from datetime import datetime, timezone
import urllib.request

API_BASE = os.environ.get("API_BASE", "http://localhost:8080")
LOT = int(os.environ.get("SIM_LOT", "1"))
SENSORS = int(os.environ.get("SIM_SENSORS", "50"))
PERIOD_SEC = float(os.environ.get("SIM_PERIOD", "2.0"))


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


def main():
    # genera lista de sensores del lot
    sensor_ids = [f"S-{LOT:02d}-{i:04d}" for i in range(1, SENSORS + 1)]
    print(f"Simulando {len(sensor_ids)} sensores contra {API_BASE}")

    while True:
        now = datetime.now(tz=timezone.utc).isoformat()
        sid = random.choice(sensor_ids)
        payload = {"sensor_id": sid, "occupied": random.random() < 0.5, "ts": now}
        try:
            post("/sensor_event", payload)
        except Exception as e:
            print(f"[WARN] fallo POST: {e}")
        time.sleep(PERIOD_SEC)


if __name__ == "__main__":
    main()
