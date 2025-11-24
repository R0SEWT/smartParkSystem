"""
Carga datos base para el esquema nuevo (campus, estacionamientos, sensores, etc.).
Uso: export $(grep -v '^#' tools/.env | xargs) ; python tools/seed_basics.py
"""
import os
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.rows import dict_row
from pymongo import MongoClient

PG_CONN = os.environ["PG_CONN"]
MONGODB_URI = os.environ["MONGODB_URI"]


def seed_postgres():
    now = datetime.now(timezone.utc)
    with psycopg.connect(PG_CONN, autocommit=True, row_factory=dict_row) as conn:
        cur = conn.cursor()

        # Campus
        cur.execute(
            """
            INSERT INTO campus (codigo, nombre, direccion, coordenadas, cantidad_estacionamientos, created_by)
            VALUES
              ('C-NORTE', 'Campus Norte', 'Av. Principal 123', '-12.05,-77.05', 2, 'seed'),
              ('C-SUR', 'Campus Sur', 'Av. Costanera 456', '-12.20,-77.10', 1, 'seed')
            ON CONFLICT (codigo) DO NOTHING;
            """
        )
        cur.execute("SELECT id, codigo FROM campus;")
        campus = {row["codigo"]: row["id"] for row in cur.fetchall()}

        # Estacionamientos
        estacionamientos = [
            ("EST-001", campus["C-NORTE"], "Puerta A", 1, 1, "rampa"),
            ("EST-002", campus["C-NORTE"], "Puerta B", 2, 1, "ascensor"),
            ("EST-003", campus["C-SUR"], "Bloque C", 3, 2, "rampa"),
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

        # Sensores (IDs fijos usando OVERRIDING para mapear con el simulador)
        install_dt = now - timedelta(days=30)
        maint_dt = now - timedelta(days=5)
        sensor_rows = [
            # estacionamiento, sensor_id
            ("EST-001", 1001),
            ("EST-001", 1002),
            ("EST-001", 1003),
            ("EST-002", 2001),
            ("EST-002", 2002),
            ("EST-003", 3001),
            ("EST-003", 3002),
        ]
        for est_id, sid in sensor_rows:
            cur.execute(
                """
                INSERT INTO sensor (
                  id, estacionamiento_id, estado_funcionamiento, fabricante, modelo,
                  fecha_instalacion, fecha_mantenimiento, version_firmware, config, created_by
                )
                OVERRIDING SYSTEM VALUE
                VALUES (%s, %s, 'operativo', 'Acme', 'SP-1', %s, %s, '1.0.0', '{}'::jsonb, 'seed')
                ON CONFLICT (id) DO NOTHING;
                """,
                (sid, est_id, install_dt, maint_dt),
            )

        # Gateways (uno por sensor)
        cur.execute("SELECT id FROM sensor;")
        sensor_ids = [row["id"] for row in cur.fetchall()]
        for sid in sensor_ids:
            cur.execute(
                """
                INSERT INTO gateway (sensor_id, serial, modelo, tipo_conexion, estado, ultima_comunicacion, created_by)
                SELECT %s, %s, 'GW-Edge', 'ethernet', 'online', %s, 'seed'
                WHERE NOT EXISTS (SELECT 1 FROM gateway WHERE sensor_id = %s);
                """,
                (sid, f"GW-{sid}", now, sid),
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
        cur.execute("SELECT id, estacionamiento_id FROM sensor;")
        for row in cur.fetchall():
            cur.execute(
                """
                INSERT INTO registro_data (sensor_id, estacionamiento_id, hora_libre, hora_ocupado, estado, created_by)
                SELECT %s, %s, %s, NULL, 'libre', 'seed'
                WHERE NOT EXISTS (
                    SELECT 1 FROM registro_data WHERE sensor_id = %s AND estado = 'libre'
                );
                """,
                (row["id"], row["estacionamiento_id"], now, row["id"]),
            )

        # Umbrales
        for sid in sensor_ids:
            cur.execute(
                """
                INSERT INTO sensor_threshold (sensor_id, min_value, max_value, alert_level, description, created_by)
                SELECT %s, 1, 100, 'info', 'umbral base', 'seed'
                WHERE NOT EXISTS (SELECT 1 FROM sensor_threshold WHERE sensor_id = %s);
                """,
                (sid, sid),
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
