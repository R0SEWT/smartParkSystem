"""
Crea datos base: lots + sensors, y un punto de ocupación por lot.
Uso: export $(grep -v '^#' tools/.env | xargs) ; python tools/seed_basics.py
"""
import os
import random
from datetime import datetime

import psycopg
from pymongo import MongoClient

PG_CONN = os.environ["PG_CONN"]
MONGODB_URI = os.environ["MONGODB_URI"]


def main():
    # PG
    with psycopg.connect(PG_CONN, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM lot;")
            count = cur.fetchone()[0]
            if count == 0:
                cur.execute("INSERT INTO lot(name) VALUES ('Monterrico'), ('San Isidro'), ('San Miguel'), ('Villa');")
                print("Seed: 4 lots creados.")

            # obtiene lots
            cur.execute("SELECT lot_id, name FROM lot;")
            lots = cur.fetchall()

            # crea sensores sintéticos y un punto de ocupación
            for lot_id, name in lots:
                # sensores S-<lotid>-<nnnn>
                for i in range(1, 11):
                    sid = f"S-{lot_id:02d}-{i:04d}"
                    cur.execute("INSERT INTO sensor(sensor_id, lot_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;", (sid, lot_id))

                total = 200  # ejemplo
                occupied = random.randint(50, 150)
                cur.execute(
                    "INSERT INTO occupancy(lot_id, ts, occupied_spaces, total_spaces) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING;",
                    (lot_id, datetime.utcnow(), occupied, total)
                )
                print(f"Seed: sensors y occup para lot {name}")

    # Mongo
    mongo = MongoClient(MONGODB_URI, tls=True, tlsAllowInvalidCertificates=False)
    mdb = mongo["smartpark"]
    col = mdb["sensors_meta"]
    col.create_index("sensor_id", unique=True)
    print("Seed: índices mongo ok.")


if __name__ == "__main__":
    main()
