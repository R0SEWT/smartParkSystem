> Estado: histórico. Plan vigente: [v2_azure_infra_showcase_1_mes.md](v2_azure_infra_showcase_1_mes.md).

## Plan: Sacar más valor de SmartParkSystem (1 mes)

Convertir el proyecto en una demo/portafolio “portfolio-grade”: reproducible en <10 min, dashboard realmente en vivo, backend robusto y una historia técnica clara (IoT → ingesta → doble persistencia → dashboard). Mantener el scope acotado a lo que ya existe: disponibilidad por campus/piso/sensor, simulación y despliegue Azure.

**Steps**
1. Definir “Definition of Done” (Día 1)
   - Demo local: levantar Postgres + Mongo, correr seed, iniciar API, iniciar simulador y ver cambios en el dashboard sin pasos manuales frágiles.
   - Demo Azure: frontend + API actualizadas, CORS correcto, /docs disponible, y al menos un flujo de simulación que alimente datos.
   - Calidad mínima: errores legibles (cliente entiende qué falló), logs útiles, y smoke tests de endpoints.

2. Semana 1 — Demo loop determinista (habilita el valor visual)
   - Alinear IDs/fixtures para que el simulador funcione “out of the box” con los estacionamientos seed (hoy SIM_EST default no existe en los seeds).
   - Endurecer /admin/reset como herramienta de demo: documentación, respuestas consistentes y evitar que falle silenciosamente.
   - Añadir un “demo runbook” en README: pasos exactos y tiempos esperados, incluyendo variables de entorno mínimas.

3. Semana 2 — Backend/API: robustez y credibilidad (depende de 2)
   - Contracto consistente de errores en api/app.py (mismo shape para 4xx/5xx; distinguir 400/401/503).
   - Validación completa de query params en registro_data_list (sensor_id int, limit bounds ya existe; añadir manejo de ValueError y mensajes claros).
   - CORS: eliminar el patrón de “reflejar cualquier Origin” y usar allowlist real basada en ALLOWED_ORIGINS (sin romper frontend Azure).
   - Observabilidad básica: logging estructurado + request id; mejorar healthzdb como señal (503 ya está) y enriquecer con latencias.
   - Seguridad mínima para demo: rate limiting en /sensor_event y /admin/reset; deshabilitar token por query string si no es necesario.
   - Tests backend (pytest): smoke tests para /healthz, /sensor_event (valid/invalid), /registro_data (params), /admin/reset (auth).

4. Semana 3 — Dashboard/UX: “real-time” y resiliencia (parcialmente paralelo con 3)
   - Auto-refresh/polling (ej. cada 3–5s) de api.registroData; evitar recargar todo si se añade soporte de incremental (ver 5).
   - Mostrar “hace X min” y estado de frescura (stale) usando minutesAgo/lastUpdated ya presentes en App.tsx.
   - Mejor manejo de errores: estados por sección (overview vs lista sensores), CTA para reintentar, y no mostrar “Datos sincronizados” si hay error.
   - Optimizar payload: decidir si el dashboard usa una agregación del backend (ver 5) o sigue derivando desde registros.

5. Semana 3–4 — Mejoras pequeñas de API que multiplican el valor del dashboard (opcional, recomendado)
   - Añadir un endpoint de resumen agregado (ej. campus/piso: libres, ocupados, lastUpdated) para reducir cómputo y bytes en frontend.
   - Añadir soporte incremental en /registro_data (ej. since/created_after) para polling eficiente.
   - Mantener compatibilidad con el consumo actual en frontend/src/api/client.ts.

6. Semana 4 — Portafolio: empaquetado, despliegue y narrativa
   - Alinear documentación y diagrama de arquitectura con lo que realmente corre (arch_demo_deploy_az.mermaid hoy menciona Azure Functions/Service Bus opcionales).
   - Agregar sección “Arquitectura y decisiones” (Mongo raw + Postgres normalizado; por qué PostGIS; por qué Key Vault references).
   - Verificar pipelines existentes (api-appservice.yml, frontend-appservice.yml) y añadir checks previos a deploy (lint/test/build).
   - Guion de demo (3–5 min): reset → simulación → dashboard reacciona; incluir capturas/GIF opcional.

**Relevant files**
- api/app.py — rutas sensor_event, registro_data_list, admin_reset; CORS (handle_preflight, ensure_cors_headers); utilidades pg_exec/pg_fetchall.
- api/models.py — modelo Pydantic SensorEvent.
- api/db_init.sql — schema demo y indexes.
- tools/seed_basics.py — seed_postgres/seed_mongo; IDs de estacionamiento/sensores.
- tools/simulator.py — load_sensor_ids/main; default SIM_EST.
- frontend/src/App.tsx — hook useAsync, cálculo de campusCards/selectedCampusFloors, UI de “sin datos”.
- frontend/src/api/client.ts — contrato RegistroData/StatusOverview y base URL.
- README.md y doc/implementation.md — runbook y despliegue.
- arch_demo_deploy_az.mermaid — alinear arquitectura real vs opcional.
- .github/workflows/api-appservice.yml y .github/workflows/frontend-appservice.yml — CI/CD actual.

**Verification**
1. Local demo: seed + simulador alimenta /sensor_event y el dashboard refleja cambios de estado sin refresh manual.
2. Contract tests: curls a /healthz, /healthzdb, /sensor_event (válido e inválido), /registro_data (con y sin filtros), /admin/reset (401 vs 200).
3. Frontend: build y preview; comprobar estados loading/error/stale y consistencia de campus/pisos.
4. Azure: despliegue via workflows; validar CORS desde el dominio del frontend y que /docs y /openapi.json respondan.

**Decisions**
- Objetivo: Demo/portafolio.
- Horizonte: 1 mes.
- Foco: Dashboard/UX + Backend/API.
- Fuera de scope (por ahora): sistema completo de reservas, app móvil, introducción de nuevos servicios Azure (Functions/Service Bus) salvo como “stretch goal” documentado.

**Further Considerations**
1. Realtime: polling (simple, recomendado) vs SSE/WebSocket (más valor técnico, más riesgo).
2. API performance: mantener derivación en cliente vs agregar endpoint de resumen (recomendado si crece el volumen).
3. Consistencia runtime: alinear Python de Dockerfile (3.12) y CI/Azure (3.10) para evitar “works on my machine” en el demo.
