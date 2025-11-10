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
   python simulator.py
   ```

4. **Probar endpoints**
   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8080/status_overview | jq
   ```

## Despliegue Azure
- Empaqueta `api/` y publícalo con `az webapp deployment source config-zip`.
- Configura `PG_CONN` y `MONGODB_URI` como referencias a Key Vault en la Web App.
- Usa Atlas M0 para Mongo y PostgreSQL Flexible Server para datos relacionales.
