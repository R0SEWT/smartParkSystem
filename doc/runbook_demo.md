# Runbook: Demo end-to-end (Azure)

Volver al hub: [doc/README.md](README.md)

Guion corto (3–5 min): [doc/demo_story.md](demo_story.md)

Objetivo: provisionar infraestructura, desplegar, generar eventos, ver el dashboard y verificar telemetría en Application Insights.

## Prerrequisitos
- Azure CLI (`az`) + sesión iniciada.
- PostgreSQL client (`psql`) para inicializar schema.
- MongoDB Atlas URI (para el secreto `MONGODB_URI`).
- GitHub Actions configuradas con publish profiles:
  - `AZURE_WEBAPP_PUBLISH_PROFILE_API` (API)
  - `AZURE_WEBAPP_PUBLISH_PROFILE` (frontend)

## 1) Provisionar con Bicep
```bash
RG=rg-smartpark-dev
LOC=brazilsouth

az group create -n "$RG" -l "$LOC"

az deployment group create \
  -g "$RG" \
  -f infra/main.bicep \
  -p infra/params/dev.bicepparam \
  -p postgresAdminPassword='***' mongodbUri='***' adminToken='***'
```

## 2) Inicializar schema (Postgres)
```bash
# Construye tu cadena PG_CONN o léela desde Key Vault.
psql "$PG_CONN" -f api/db_init.sql
```

## 3) Desplegar (GitHub Actions)
- API: workflow [api-appservice.yml](../.github/workflows/api-appservice.yml)
- Frontend: workflow [frontend-appservice.yml](../.github/workflows/frontend-appservice.yml)

Validación rápida:
- API: `GET https://smartparksystemapi.azurewebsites.net/healthz`
- Frontend: abre `https://smartparksysten.azurewebsites.net`

## 4) Reset de demo (opcional)
```bash
curl -X POST "https://smartparksystemapi.azurewebsites.net/admin/reset" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

## 5) Generar eventos (simulador)
```bash
cd tools
export API_BASE="https://smartparksystemapi.azurewebsites.net"
python simulator.py
```

## 6) Verificar observabilidad (Application Insights)
- Revisa [doc/observability.md](observability.md) para queries KQL.
- Toma el `X-Request-ID` de una respuesta y úsalo para correlación en logs.

## Checklist
- [ ] Frontend carga y consulta la API (sin errores CORS).
- [ ] El simulador alimenta `POST /sensor_event`.
- [ ] Dashboard refleja cambios (polling).
- [ ] App Insights muestra requests + dependencies.
