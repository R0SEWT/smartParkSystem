#!/usr/bin/env bash
set -euo pipefail

# Cargar variables de entorno desde .env (sin export)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
elif [ -f ../tools/.env ]; then
    export $(grep -v '^#' ../tools/.env | grep -v '^export' | xargs)
fi

# Debug: mostrar si las variables están cargadas
echo "PG_CONN está definido: ${PG_CONN:+SI}"
echo "MONGODB_URI está definido: ${MONGODB_URI:+SI}"

# Gunicorn para producción en App Service
exec gunicorn -w 2 -b 0.0.0.0:${PORT:-8080} app:app