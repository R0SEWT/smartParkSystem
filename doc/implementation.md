# Detalles del despliegue (Azure)

Volver al hub: [doc/README.md](README.md)

## Opción 1 (recomendada): IaC con Bicep
La forma más “portfolio-grade” y reproducible es usar Bicep.

- Guía y comandos: [infra/README.md](../infra/README.md)
- Bicep: `infra/main.bicep`
- Observabilidad: [doc/observability.md](observability.md)

Nota importante:
- Los workflows despliegan por defecto a `smartparksystemapi` (API) y `smartparksysten` (frontend). El Bicep usa esos mismos defaults.
- Si cambias nombres, actualiza también los valores `WEBAPP_NAME` en los workflows.

## Opción 2: despliegue manual con Azure CLI (referencia)
Esta ruta es útil para entender piezas, pero es más fácil equivocarse que con IaC.

### Recursos
- PostgreSQL Flexible Server + PostGIS
- App Service Plan (Linux)
- Web App API (Python)
- Web App Frontend (Linux)
- Key Vault con **RBAC** (evitar access policies)

### Pasos
1) Variables mínimas
```bash
RG=rg-smartpark-dev
LOC=brazilsouth

PG=smartpark-dev-pg
PG_ADMIN=pgadmin
PG_PASS='***'
PG_DB=smartpark

KV=smartpark-dev-kv
PLAN=asp-smartpark-b1
WEBAPP_API=smartparksystemapi
WEBAPP_FE=smartparksysten
```

2) Login y Resource Group
```bash
az login
az group create -n "$RG" -l "$LOC"
```

3) PostgreSQL Flexible Server (demo)
```bash
az postgres flexible-server create \
  -g "$RG" -n "$PG" -l "$LOC" \
  --tier Burstable --sku-name Standard_B1ms \
  --version 16 --storage-size 64 \
  --administrator-user "$PG_ADMIN" --administrator-password "$PG_PASS" \
  --public-access all

az postgres flexible-server db create -g "$RG" -s "$PG" -d "$PG_DB"

PG_HOST=$(az postgres flexible-server show -g "$RG" -n "$PG" --query "fullyQualifiedDomainName" -o tsv)
export PG_CONN="postgresql://${PG_ADMIN}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}?sslmode=require"
```

4) Key Vault con RBAC + secretos
```bash
az keyvault create -g "$RG" -n "$KV" -l "$LOC" --enable-rbac-authorization true

az keyvault secret set --vault-name "$KV" -n PG_CONN --value "$PG_CONN"
# También necesitas estos secretos para el backend:
# az keyvault secret set --vault-name "$KV" -n MONGODB_URI --value '***'
# az keyvault secret set --vault-name "$KV" -n ADMIN_TOKEN --value '***'
```

5) App Service (plan + apps)
```bash
az appservice plan create -g "$RG" -n "$PLAN" --is-linux --sku B1 --location "$LOC"
az webapp create -g "$RG" -p "$PLAN" -n "$WEBAPP_API" --runtime "PYTHON:3.10"
az webapp create -g "$RG" -p "$PLAN" -n "$WEBAPP_FE" --runtime "NODE|20-lts"
```

6) Managed Identity + permisos a Key Vault (RBAC)
```bash
az webapp identity assign -g "$RG" -n "$WEBAPP_API"
APP_MI_PRINCIPAL_ID=$(az webapp identity show -g "$RG" -n "$WEBAPP_API" --query principalId -o tsv)
KV_ID=$(az keyvault show -g "$RG" -n "$KV" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$APP_MI_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID"
```

7) App Settings (Key Vault References + CORS)
```bash
az webapp config appsettings set -g "$RG" -n "$WEBAPP_API" --settings \
  PG_CONN="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/PG_CONN/)" \
  MONGODB_URI="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/MONGODB_URI/)" \
  ADMIN_TOKEN="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/ADMIN_TOKEN/)" \
  ALLOWED_ORIGINS="https://${WEBAPP_FE}.azurewebsites.net"
```

8) Inicializar schema (PostGIS + tablas)
```bash
psql "$PG_CONN" -f api/db_init.sql
```

9) Despliegue (recomendado vía GitHub Actions)
- API: [.github/workflows/api-appservice.yml](../.github/workflows/api-appservice.yml)
- Frontend: [.github/workflows/frontend-appservice.yml](../.github/workflows/frontend-appservice.yml)
