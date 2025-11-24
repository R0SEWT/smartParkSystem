"""
Carga datos base para el esquema nuevo (campus, estacionamientos, sensores, etc.).
Uso: export $(grep -v '^#' tools/.env | xargs) ; python tools/seed_basics.py
"""
import os
from datetime import datetime, timedelta, timezone
import json

import psycopg
from psycopg.rows import dict_row
from psycopg.extras import execute_values
from pymongo import MongoClient

PG_CONN = os.environ["PG_CONN"]
MONGODB_URI = os.environ["MONGODB_URI"]


def seed_postgres():
    now = datetime.now(timezone.utc)
    with psycopg.connect(PG_CONN, autocommit=True, row_factory=dict_row) as conn:
        cur = conn.cursor()

        # Campus (4 sedes)
        campus_def = [
            ("MON", "Monterrico", "Av. Primavera 123", "-12.10,-76.97"),
            ("SMG", "San Miguel", "Av. La Marina 456", "-12.07,-77.08"),
            ("SIZ", "San Isidro", "Av. Javier Prado 789", "-12.09,-77.04"),
            ("VIL", "Villa", "Av. Universitaria 321", "-12.16,-76.98"),
        ]
        for code, name, addr, coord in campus_def:
            cur.execute(
                """
                INSERT INTO campus (codigo, nombre, direccion, coordenadas, cantidad_estacionamientos, created_by)
                VALUES (%s, %s, %s, %s, 0, 'seed')
                ON CONFLICT (codigo) DO NOTHING;
                """,
                (code, name, addr, coord),
            )
        cur.execute("SELECT id, codigo FROM campus;")
        campus = {row["codigo"]: row["id"] for row in cur.fetchall()}

        # Estacionamientos por sede (2-4 plantas, 2-3 estacionamientos por planta)
        estacionamientos = [
            # Monterrico (3 plantas, 3 por planta)
            ("MON-1A", campus["MON"], "Ingreso A piso 1", 1, 1, "rampa"),
            ("MON-1B", campus["MON"], "Ingreso B piso 1", 2, 1, "ascensor"),
            ("MON-1C", campus["MON"], "Ingreso C piso 1", 3, 1, "rampa"),
            ("MON-2A", campus["MON"], "Ingreso A piso 2", 1, 2, "ascensor"),
            ("MON-2B", campus["MON"], "Ingreso B piso 2", 2, 2, "rampa"),
            ("MON-2C", campus["MON"], "Ingreso C piso 2", 3, 2, "rampa"),
            ("MON-3A", campus["MON"], "Ingreso A piso 3", 1, 3, "ascensor"),
            ("MON-3B", campus["MON"], "Ingreso B piso 3", 2, 3, "rampa"),
            ("MON-3C", campus["MON"], "Ingreso C piso 3", 3, 3, "rampa"),
            # San Miguel (2 plantas, 2 por planta)
            ("SMG-1A", campus["SMG"], "Acceso mar piso 1", 1, 1, "rampa"),
            ("SMG-1B", campus["SMG"], "Acceso costanera piso 1", 2, 1, "ascensor"),
            ("SMG-2A", campus["SMG"], "Acceso mar piso 2", 1, 2, "ascensor"),
            ("SMG-2B", campus["SMG"], "Acceso costanera piso 2", 2, 2, "rampa"),
            # San Isidro (2 plantas, 2 por planta)
            ("SIZ-1A", campus["SIZ"], "Lobby principal piso 1", 1, 1, "ascensor"),
            ("SIZ-1B", campus["SIZ"], "Lobby secundario piso 1", 2, 1, "rampa"),
            ("SIZ-2A", campus["SIZ"], "Lobby principal piso 2", 1, 2, "ascensor"),
            ("SIZ-2B", campus["SIZ"], "Lobby secundario piso 2", 2, 2, "rampa"),
            # Villa (2 plantas, 2 por planta)
            ("VIL-1A", campus["VIL"], "Bloque A piso 1", 1, 1, "rampa"),
            ("VIL-1B", campus["VIL"], "Bloque B piso 1", 2, 1, "ascensor"),
            ("VIL-2A", campus["VIL"], "Bloque A piso 2", 1, 2, "ascensor"),
            ("VIL-2B", campus["VIL"], "Bloque B piso 2", 2, 2, "rampa"),
        ]
        for est_id, campus_id, ubicacion, numero, piso, acc in estacionamientos:
            cur.execute(
                """
                INSERT INTO estacionamiento (id, campus_id, ubicacion, numero, piso, accesibilidad, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, 'seed')
                ON CONFLICT (id) DO NOTHING;
                """,
                (est_id, campus_id, ubicacion, numero, piso, acc),
            )

        # Actualizar contador de estacionamientos por campus
        for code, campus_id in campus.items():
            cur.execute(
                """
                UPDATE campus SET cantidad_estacionamientos = (
                    SELECT COUNT(*) FROM estacionamiento WHERE campus_id = %s
                )
                WHERE id = %s;
                """,
                (campus_id, campus_id),
            )

        # Roles y usuarios
        cur.execute(
            """
            INSERT INTO rol (nombre_rol, created_by)
            VALUES ('admin', 'seed'), ('operador', 'seed')
            ON CONFLICT (nombre_rol) DO NOTHING;
            """
        )
        cur.execute("SELECT id, nombre_rol FROM rol;")
        roles = {row["nombre_rol"]: row["id"] for row in cur.fetchall()}

        users = [
            ("Ana", "Admin", "ana.admin@example.com", "ADM001", "admin"),
            ("Oscar", "Operador", "oscar.op@example.com", "OP001", "operador"),
        ]
        for nombre, apellido, email, codigo, rol_name in users:
            cur.execute(
                """
                INSERT INTO usuario (nombre, apellido, email, codigo, rol, rol_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, 'seed')
                ON CONFLICT (email) DO NOTHING;
                """,
                (nombre, apellido, email, codigo, rol_name, roles[rol_name]),
            )

        # Sensores (IDs fijos, tipos por sede)
        install_dt = now - timedelta(days=30)
        maint_dt = now - timedelta(days=5)
        sensor_rows = []
        sid_counter = 1000
        for est_id, campus_id, *_rest in estacionamientos:
            # Monterrico y San Miguel alternan lorawan / ultrasonico
            tipo = None
            campus_code = [k for k, v in campus.items() if v == campus_id][0]
            if campus_code in ("MON", "SMG"):
                tipo = "lorawan" if sid_counter % 2 == 0 else "ultrasonico"
            for _ in range(4):  # 4 sensores por estacionamiento
                sid_counter += 1
                sensor_rows.append((est_id, sid_counter, tipo))

        if sensor_rows:
            execute_values(
                cur,
                """
                INSERT INTO sensor (
                  id, estacionamiento_id, estado_funcionamiento, fabricante, modelo,
                  fecha_instalacion, fecha_mantenimiento, version_firmware, config, created_by
                )
                OVERRIDING SYSTEM VALUE
                VALUES %s
                ON CONFLICT (id) DO NOTHING;
                """,
                [
                    (
                        sid,
                        est_id,
                        "operativo",
                        "Acme",
                        "SP-1",
                        install_dt,
                        maint_dt,
                        "1.0.0",
                        json.dumps({"tipo": tipo} if tipo else {}),
                        "seed",
                    )
                    for est_id, sid, tipo in sensor_rows
                ],
            )

        # Gateways (uno por sensor)
        cur.execute("SELECT id, estacionamiento_id FROM sensor;")
        sensor_rows_full = cur.fetchall()
        sensor_ids = [row["id"] for row in sensor_rows_full]
        if sensor_ids:
            execute_values(
                cur,
                """
                INSERT INTO gateway (sensor_id, serial, modelo, tipo_conexion, estado, ultima_comunicacion, created_by)
                VALUES %s
                ON CONFLICT DO NOTHING;
                """,
                [(sid, f"GW-{sid}", "GW-Edge", "ethernet", "online", now, "seed") for sid in sensor_ids],
            )

        # Reservas de ejemplo
        cur.execute("SELECT id FROM usuario WHERE email = 'oscar.op@example.com';")
        usuario_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO reserva (usuario_id, estacionamiento_id, hora_inicio, hora_fin, estado, fecha_creacion, created_by)
            VALUES (%s, 'EST-001', %s, %s, 'confirmada', %s, 'seed')
            ON CONFLICT DO NOTHING;
            """,
            (usuario_id, now, now + timedelta(hours=2), now),
        )

        # Registro de datos inicial
        if sensor_rows_full:
            execute_values(
                cur,
                """
                INSERT INTO registro_data (sensor_id, estacionamiento_id, hora_libre, hora_ocupado, estado, created_by)
                VALUES %s
                ON CONFLICT DO NOTHING;
                """,
                [(row["id"], row["estacionamiento_id"], now, None, "libre", "seed") for row in sensor_rows_full],
            )

        # Umbrales
        if sensor_ids:
            execute_values(
                cur,
                """
                INSERT INTO sensor_threshold (sensor_id, min_value, max_value, alert_level, description, created_by)
                VALUES %s
                ON CONFLICT DO NOTHING;
                """,
                [(sid, 1, 100, "info", "umbral base", "seed") for sid in sensor_ids],
            )

        print("Seed Postgres completo.")


def seed_mongo():
    mongo = MongoClient(MONGODB_URI, tls=True, tlsAllowInvalidCertificates=False)
    mdb = mongo["smartpark"]
    col = mdb["sensors_meta"]
    col.create_index("sensor_id", unique=True)
    print("Seed Mongo: índices y colección ok.")


def main():
    seed_postgres()
    seed_mongo()


if __name__ == "__main__":
    main()
