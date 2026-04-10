# Observabilidad (Azure Application Insights)

Volver al hub: [doc/README.md](README.md)

## Objetivo
Que el demo muestre claramente operación en Azure: trazas por request, dependencias (Postgres/Mongo), errores y latencias, todo visible en Application Insights.

## Configuración (Backend)
1. Crea/usa un recurso de **Application Insights** (workspace-based recomendado).
2. Copia el **Connection String**.
3. En la Web App del backend configura uno de estos App Settings:
   - `APPLICATIONINSIGHTS_CONNECTION_STRING` (recomendado)
   - `AZURE_MONITOR_CONNECTION_STRING` (alternativo)

La API intentará configurar automáticamente Azure Monitor OpenTelemetry en el arranque. Cada respuesta incluye `X-Request-ID`.

## Validación rápida
- Genera tráfico:
  - `GET /healthz`
  - `GET /healthzdb`
  - `POST /sensor_event` (desde `tools/simulator.py`)
  - `GET /registro_data`
- En Application Insights revisa:
  - **Transactions**: requests por endpoint.
  - **Failures**: 4xx/5xx.
  - **Dependencies**: llamadas a Postgres/Mongo.

## KQL útil (Log Analytics)
Últimos requests (30 min):
```kusto
requests
| where timestamp > ago(30m)
| project timestamp, name, resultCode, duration, operation_Id
| order by timestamp desc
```

Errores (5xx) por endpoint:
```kusto
requests
| where timestamp > ago(24h)
| where toint(resultCode) >= 500
| summarize count() by name, resultCode
| order by count_ desc
```

Latencia p95 por endpoint:
```kusto
requests
| where timestamp > ago(24h)
| summarize p95=percentile(duration, 95) by name
| order by p95 desc
```

Dependencias más lentas:
```kusto
dependencies
| where timestamp > ago(24h)
| summarize p95=percentile(duration, 95), count() by type, target, name
| order by p95 desc
```

Trazas (logs) recientes:
```kusto
traces
| where timestamp > ago(30m)
| project timestamp, severityLevel, message, customDimensions
| order by timestamp desc
```
