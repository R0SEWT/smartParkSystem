# ADR 0001: Persistencia dual (PostgreSQL + MongoDB)

- Estado: Accepted
- Fecha: 2026-04-09

## Contexto
SmartPark necesita soportar:
- Consultas relacionales y geoespaciales (PostGIS) para un modelo “canónico” consistente.
- Captura de eventos IoT crudos (append-only) y metadata flexible por sensor.

Para el demo también es útil:
- Poder resetear y reseedear datos de forma determinista.
- Inspeccionar eventos crudos sin acoplar el esquema relacional.

## Decisión
- Persistir el modelo relacional en PostgreSQL (con PostGIS habilitado).
- Persistir eventos crudos en MongoDB (`events_raw`) y metadata opcional en `sensors_meta`.
- La ingesta `POST /sensor_event` registra el evento crudo en Mongo y luego escribe/actualiza el estado/modelo en PostgreSQL.

## Consecuencias
- (+) PostgreSQL queda como store principal para queries de estado/consistencia; PostGIS habilita casos geo.
- (+) Mongo preserva el historial crudo para auditoría/debug y permite evolucionar payloads sin migraciones inmediatas.
- (-) Se duplica la persistencia: hay fallos parciales que deben observarse y manejarse.
- (-) No hay transacción distribuida: la consistencia es eventual entre stores.

## Alternativas consideradas
- Solo PostgreSQL: simplifica consistencia, pero hace más rígido el manejo/evolución de eventos crudos.
- Solo MongoDB: flexible para eventos, pero menos adecuado como canonical relational/spatial store.

## Referencias
- [api/app.py](../../api/app.py)
- [api/db_init.sql](../../api/db_init.sql)
- [doc/mongo_diagram.mmd](../mongo_diagram.mmd)
- [doc/posgress_diagram.erd](../posgress_diagram.erd)
