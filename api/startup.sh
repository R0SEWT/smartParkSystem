#!/usr/bin/env bash
set -euo pipefail
# Gunicorn para producción en App Service
exec gunicorn -w 2 -b 0.0.0.0:${PORT:-8080} app:app
