# Contribuir

Gracias por contribuir a SmartParkSystem.

## Desarrollo local
El flujo completo (Azure) está en [doc/runbook_demo.md](doc/runbook_demo.md). Para correr local:

### Backend (API)
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export PG_CONN='postgresql://...'
export MONGODB_URI='mongodb+srv://...'
export ALLOWED_ORIGINS='http://localhost:5173'

python app.py
```

### Frontend
```bash
cd frontend
npm install
echo 'VITE_API_BASE=http://localhost:8080' > .env.local
npm run dev
```

## Tests

### Smoke tests (sin Postgres/Mongo)
Los smoke tests se ejecutan en CI antes del deploy usando `SMARTPARK_TESTING=1`.

```bash
cd api
SMARTPARK_TESTING=1 python -m unittest discover -s tests -p 'test_*.py' -q
```

## Estilo / reglas rápidas
- Cambios que afecten la demo deben actualizar al menos una de estas piezas: README / runbook / implementación.
- Evitar hardcode de secretos. Para Azure, usar Key Vault References.
- Mantener docs en español y links relativos.

## Pull Requests
- Título claro y descripción corta (qué y por qué).
- Checklist del template completo.
