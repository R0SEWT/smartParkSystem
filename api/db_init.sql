-- Extensión espacial
CREATE EXTENSION IF NOT EXISTS postgis;

-- Esquema mínimo
CREATE TABLE IF NOT EXISTS lot (
  lot_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  geom geometry(MultiPolygon, 4326)
);

CREATE TABLE IF NOT EXISTS sensor (
  sensor_id TEXT PRIMARY KEY,
  lot_id INT REFERENCES lot(lot_id),
  location geometry(Point, 4326),
  installed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS occupancy (
  lot_id INT REFERENCES lot(lot_id),
  ts TIMESTAMP NOT NULL,
  occupied_spaces INT NOT NULL,
  total_spaces INT NOT NULL,
  PRIMARY KEY (lot_id, ts)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  sensor_id TEXT REFERENCES sensor(sensor_id),
  ts TIMESTAMP NOT NULL,
  occupied BOOLEAN NOT NULL,
  payload_jsonb JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_events_sensor_ts ON events(sensor_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_payload_gin ON events USING GIN (payload_jsonb);
CREATE INDEX IF NOT EXISTS idx_occupancy_lot_ts ON occupancy(lot_id, ts DESC);
