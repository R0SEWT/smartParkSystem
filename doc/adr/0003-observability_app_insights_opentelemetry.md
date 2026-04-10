# ADR 0003: Observabilidad (Application Insights + OpenTelemetry)

- Estado: Accepted
- Fecha: 2026-04-09

## Contexto
Para un demo “Azure-first” necesitamos:
- Ver requests, errores, latencias y dependencias (PostgreSQL/MongoDB) en **Application Insights**.
- Correlacionar logs por request (request id) para troubleshooting.

## Decisión
- Instrumentar la API con `azure-monitor-opentelemetry` de forma **opcional** (se activa con `APPLICATIONINSIGHTS_CONNECTION_STRING` o `AZURE_MONITOR_CONNECTION_STRING`).
- Emitir logs estructurados (JSON) e incluir contexto HTTP y `request_id`.
- Propagar `X-Request-ID` en respuestas (y respetar un `X-Request-ID` entrante si existe).

## Consecuencias
- (+) Application Insights muestra telemetría sin acoplar el frontend.
- (+) Correlación end-to-end más simple.
- (-) Dependencia y coste/ruido adicional si se habilita en entornos no deseados.

## Alternativas consideradas
- SDK “clásico” de Application Insights (sin OpenTelemetry).
- Logging plano sin correlación.
- Observabilidad solo con logs de App Service.

## Referencias
- [api/app.py](../../api/app.py)
- [api/requirements.txt](../../api/requirements.txt)
- [doc/observability.md](../observability.md)
