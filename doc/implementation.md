# Detalles del despliegue de la aplicación Smart Park System

Crear un grupo de recursos (RG) en Azure, un servidor flexible de PostgreSQL en la región de Brazil South, un Azure Key Vault y un Azure App Service.

1. Nos logueamos a Az
2. `az group create -n "$RG" -l "$LOC"` (crear grupo de recursos)
3. PostgreSQL Flexible Server (burstable barato para demo) SKU válido típico: Standard_B1ms / Standard_B2ms

```

az postgres flexible-server create \
  -g "$RG" -n "$PG" -l "$LOC" \
  --tier Burstable --sku-name Standard_B1ms \
  --version 16 --storage-size 64 \
  --administrator-user "$PG_ADMIN" --administrator-password "$PG_PASS" \
  --public-access all
  ```
4. Creamos la app de base de datos Postgress `az postgres flexible-server db create -g "$RG" -s "$PG" -d "$PG_DB"`
5. Creamos el Key Vault (para guardar la cadena de conexion como secreto) `az keyvault create -g "$RG" -n "$KV" -l "$LOC"`
6. Creamos/obtenemos la cadena de conexion de posgres 

```

PG_HOST=$(az postgres flexible-server show -g "$RG" -n "$PG" --query "fullyQualifiedDomainName" -o tsv)
export PG_CONN="postgresql://${PG_ADMIN}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}?sslmode=require"

```

7. Guardamos la cadena `az keyvault secret set --vault-name "$KV" -n PG_CONN --value "$PG_CONN"`
8. Creamos la app service 
```
az appservice plan create -g "$RG" -n "$PLAN" --is-linux --sku B1 --location "$LOC"
az webapp create -g "$RG" -p "$PLAN" -n "$WEBAPP" --runtime "PYTHON:3.10"

```
9. Habilitamos la identidad: 
```
az webapp identity assign -g "$RG" -n "$WEBAPP"
APP_MI_PRINCIPAL_ID=$(az webapp identity show -g "$RG" -n "$WEBAPP" --query principalId -o tsv)
```
10. Permisos de secretos
`az keyvault set-policy -n "$KV" --object-id "$APP_MI_PRINCIPAL_ID" --secret-permissions get list`
11. Linkeamos app settings al vault:
```
az webapp config appsettings set -g "$RG" -n "$WEBAPP" --settings \
  PG_CONN="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/PG_CONN/)"
```




- PostgreSQL Flexible Server (relacional canonical, soportado)

- App Service Linux Python (API)

- Key Vault con RBAC (enterprise grade, no “policies legacy”)

- datos spatio-temporal → PostGIS

- provisionamos infraestructura base en Brazil South:

- Resource Group

- PostgreSQL Flexible Server + DB smartpark

- Key Vault

- App Service Plan B1 + WebApp Python

se fijó seguridad correctamente:

Key Vault con RBAC

WebApp = System Assigned MI

WebApp tiene rol Key Vault Secrets User

tú tienes rol Key Vault Secrets Officer

se guardó el secret PG-CONN en Key Vault
y se insertó en WebApp como Key Vault Reference → PG_CONN

se validó funcionalmente la resolución de Key Vault Reference (sin exponer secretos en claro)