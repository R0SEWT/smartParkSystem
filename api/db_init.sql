-- Extensiones
CREATE EXTENSION IF NOT EXISTS postgis;

-- Limpieza de tablas de la demo anterior (precaución: elimina datos).
DROP TABLE IF EXISTS sensor_threshold, gateway, registro_data, reserva, usuario, rol, sensor, estacionamiento, campus, events, occupancy, lot CASCADE;

-- Campus universitarios donde existen estacionamientos.
CREATE TABLE campus (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  coordenadas TEXT,
  cantidad_estacionamientos INTEGER NOT NULL CHECK (cantidad_estacionamientos >= 0),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);

-- Estacionamientos individuales dentro de un campus.
CREATE TABLE estacionamiento (
  id TEXT PRIMARY KEY,
  campus_id INTEGER NOT NULL REFERENCES campus(id) ON DELETE CASCADE,
  ubicacion TEXT NOT NULL,
  numero INTEGER NOT NULL,
  piso INTEGER NOT NULL,
  accesibilidad TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);
CREATE INDEX idx_estacionamiento_campus ON estacionamiento(campus_id);

-- Catálogo de roles y usuarios del sistema.
CREATE TABLE rol (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_rol TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);

CREATE TABLE usuario (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  codigo TEXT,
  rol TEXT NOT NULL,
  rol_id INTEGER NOT NULL REFERENCES rol(id),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);
CREATE INDEX idx_usuario_rol_id ON usuario(rol_id);

-- Sensores de ocupación instalados en cada estacionamiento.
CREATE TABLE sensor (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estacionamiento_id TEXT NOT NULL REFERENCES estacionamiento(id) ON DELETE CASCADE,
  estado_funcionamiento TEXT NOT NULL,
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  fecha_instalacion TIMESTAMPTZ NOT NULL,
  fecha_mantenimiento TIMESTAMPTZ NOT NULL,
  version_firmware TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);
CREATE INDEX idx_sensor_estacionamiento ON sensor(estacionamiento_id);

-- Gateways asociados a sensores.
CREATE TABLE gateway (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sensor_id INTEGER NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  serial TEXT,
  modelo TEXT,
  tipo_conexion TEXT,
  estado TEXT,
  ultima_comunicacion TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);
CREATE INDEX idx_gateway_sensor ON gateway(sensor_id);

-- Reservas de estacionamientos.
CREATE TABLE reserva (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  estacionamiento_id TEXT NOT NULL REFERENCES estacionamiento(id) ON DELETE CASCADE,
  hora_inicio TIMESTAMPTZ,
  hora_fin TIMESTAMPTZ,
  estado TEXT,
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);
CREATE INDEX idx_reserva_usuario ON reserva(usuario_id);
CREATE INDEX idx_reserva_estacionamiento ON reserva(estacionamiento_id);

-- Registro histórico de ocupación detectada por sensores.
CREATE TABLE registro_data (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sensor_id INTEGER NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  estacionamiento_id TEXT NOT NULL REFERENCES estacionamiento(id) ON DELETE CASCADE,
  hora_libre TIMESTAMPTZ,
  tiempo_libre TIME,
  hora_ocupado TIMESTAMPTZ,
  tiempo_ocupado TIME,
  estado TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ
);
CREATE INDEX idx_registro_data_sensor ON registro_data(sensor_id);
CREATE INDEX idx_registro_data_est ON registro_data(estacionamiento_id);

-- Umbrales configurables por sensor.
CREATE TABLE sensor_threshold (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sensor_id INTEGER NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  min_value INTEGER,
  max_value INTEGER,
  alert_level TEXT,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by TEXT,
  modified_at TIMESTAMPTZ,
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);
CREATE INDEX idx_sensor_threshold_sensor ON sensor_threshold(sensor_id);
