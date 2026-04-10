# infra (Bicep)

Infraestructura Azure para el demo SmartPark (enfoque: IaC + observabilidad + Key Vault + MI).

## Qué crea
- Log Analytics Workspace
- Application Insights (workspace-based)
- PostgreSQL Flexible Server + DB (public access; demo)
- Key Vault (RBAC) + secretos: `PG_CONN`, `MONGODB_URI`, `ADMIN_TOKEN`
- App Service Plan Linux (B1)
- Web App Linux Python 3.10 (API)
  - App Settings con Key Vault References
  - `APPLICATIONINSIGHTS_CONNECTION_STRING` para telemetría
  - System Assigned Managed Identity + rol **Key Vault Secrets User**
- Web App Linux Node.js (Frontend)
  - Sirve assets estáticos (SPA) desde `wwwroot` (startup: `pm2 serve ... --spa`)

## Prerrequisitos
- Azure CLI (`az`) con sesión iniciada: `az login`
- Bicep: `az bicep install` (si aplica)

## Despliegue
1. Crear Resource Group
```bash
RG=rg-smartpark-dev
LOC=brazilsouth
az group create -n "$RG" -l "$LOC"
```

2. Desplegar Bicep (los secretos van como parámetros seguros)
```bash
az deployment group create \
  -g "$RG" \
  -f infra/main.bicep \
  -p infra/params/dev.bicepparam \
  -p postgresAdminPassword='***' mongodbUri='***' adminToken='***'
```

Notas:
- Los nombres `smartparksystemapi` y `smartparksysten` están alineados con los valores por defecto en los workflows de GitHub Actions.
- Si cambias estos nombres, actualiza también `.github/workflows/*` (variables `WEBAPP_NAME`).

3. Inicializar el schema (PostGIS + tablas)
```bash
# Obtén el PG_CONN desde Key Vault o construye la cadena y ejecútalo localmente
psql "$PG_CONN" -f api/db_init.sql
```

4. Desplegar la API
- El repo ya tiene GitHub Actions para desplegar `api/` a App Service.
- Configura los secretos/publish profiles según README principal.

5. Desplegar el frontend
- El repo ya tiene GitHub Actions para desplegar `frontend/` a App Service.
- El workflow compila `frontend/dist` y despliega el zip a la Web App frontend.

## Notas de seguridad
- `allow-all` en el firewall de Postgres es **solo para demo**.
- Para producción: restringe IPs, habilita red privada, y rota secretos.
