# smartParkSystem

Servicios y herramientas para capturar eventos de sensores IoT de estacionamientos, persistir en PostgreSQL/MongoDB y exponer una API Flask desplegable en Azure App Service.

## Requisitos
- Python 3.10+
- PostgreSQL con PostGIS
- MongoDB (Atlas recomendado)
- `psql`, `pip`, `virtualenv`

## Estructura
```
api/               # API Flask + scripts
  app.py
  models.py
  db_init.sql
  requirements.txt
  startup.sh

tools/             # scripts auxiliares para datos y simulación
  .env.example
  seed_basics.py
  simulator.py
```

## Uso local
1. **API**
   ```bash
   cd api
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   # opcional: CORS para frontend en localhost:5173
   export ALLOWED_ORIGINS=http://localhost:5173
   # opcional: token para endpoint /admin/reset
   export ADMIN_TOKEN=superseguro
   export PG_CONN="postgresql://pgadmin:PASS@HOST:5432/smartpark?sslmode=require"
   export MONGODB_URI="mongodb+srv://USER:PASS@CLUSTER/"
   python app.py  # o ./startup.sh
   ```

2. **Inicializar DB**
   ```bash
   psql "$PG_CONN" -f api/db_init.sql
   ```

3. **Seed + simulador**
   ```bash
   cd tools
   cp .env.example .env && edit .env
   export $(grep -v '^#' .env | xargs)
   python seed_basics.py
   # opcional: ajustar SIM_EST / SIM_SENSOR_IDS / SIM_PERIOD
   python simulator.py
   ```

4. **Probar endpoints**
   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8080/status_overview | jq
   ```

## Frontend (React + Vite + Tailwind)
1. Instalar deps
   ```bash
   cd frontend
   npm install
   ```
2. Crear `.env.local` (opcional) con `VITE_API_BASE=http://localhost:8080`
3. Correr en dev
   ```bash
   npm run dev
   ```
   Abre http://localhost:5173 para ver el dashboard.

## Despliegue Azure
- Empaqueta `api/` y publícalo con `az webapp deployment source config-zip`.
- Configura `PG_CONN` y `MONGODB_URI` como referencias a Key Vault en la Web App.
- Usa Atlas M0 para Mongo y PostgreSQL Flexible Server para datos relacionales.

### Frontend: despliegue en Azure App Service
- **Servicio**: Web App Linux (plan `asp-smartpark-b1`) sirviendo únicamente assets estáticos de `frontend/dist`. Dominio generado: `https://smartparksysten.azurewebsites.net`.
- **Backend**: por defecto el build usa `.env.production` con `VITE_API_BASE=https://app-smartpark-api.azurewebsites.net`. Para entorno local sigue existiendo `.env.local` si quieres apuntar a `http://localhost:8080`.
- **Build**: `cd frontend && npm ci && npm run build` (o `npm run build -- --base=/` si usas rutas relativas). Output final queda bajo `frontend/dist`.
- **Empaquetado y despliegue manual**:
  ```bash
  cd frontend
  npm ci && npm run build
  cd dist && zip -r ../dist.zip .
  az webapp deploy -g "$RG" -n smartparksysten --src-path ../dist.zip --type static
  ```
- **CI/CD (GitHub Actions)**: el workflow [`frontend-appservice.yml`](.github/workflows/frontend-appservice.yml) compila (`npm ci && npm run build`) y publica `frontend/dist` usando `azure/webapps-deploy@v3`. Exporta el *publish profile* de la Web App y guárdalo como secreto `AZURE_WEBAPP_PUBLISH_PROFILE`; el job también inyecta `VITE_API_BASE` con el mismo valor que `.env.production`.
- **CORS**: define la variable `ALLOWED_ORIGINS` en la Web App del backend con `https://smartparksysten.azurewebsites.net` y cualquier otro dominio (separados por coma) para evitar errores CORS.

### Backend: despliegue continuo API Flask
- **Workflow**: [`api-appservice.yml`](.github/workflows/api-appservice.yml) (GitHub Actions) empaca el directorio `api/` como zip y lo publica en `app-smartpark-api`.
- **Configuración necesaria**:
  - Secreto `AZURE_WEBAPP_PUBLISH_PROFILE_API` con el *publish profile* de la Web App backend (igual que el frontend pero para `app-smartpark-api`).
  - App Settings en Azure: `PG_CONN`, `MONGODB_URI`, `ALLOWED_ORIGINS` (incluye `https://smartparksysten.azurewebsites.net`), `ADMIN_TOKEN` (opcional) y cualquier var adicional.
- **Ejecución**: dispara al hacer push en `api/**` o manualmente desde Actions. El zip despliega `app.py` y `startup.sh`; App Service detecta Python 3.10 y ejecuta `gunicorn`/`flask` según configuración.
