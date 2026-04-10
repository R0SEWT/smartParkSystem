> Estado: vigente (al 2026-04-09). Histórico anterior: [v1_demo_portafolio_1_mes.md](v1_demo_portafolio_1_mes.md).

## Plan: SmartParkSystem Azure Showcase (Infra-first, 1 mes)

Usar SmartPark como “demo ancla” para lucir Azure de forma tangible: IaC con Bicep, CI/CD serio, observabilidad (App Insights), seguridad (Key Vault + Managed Identity) y operación (alertas/runbook). Mantener UX simple (dashboard) pero con datos realmente en vivo.

**Steps**
1. Baseline y estado actual (ya avanzado)
   - Ya implementado en el repo: polling en dashboard, lista “latest por sensor”, CORS por allowlist, validación de `sensor_id`, y `/admin/reset` limpiando Mongo para demo determinista.
   - Ajustar el plan asumiendo que el “demo loop” base ya existe y se puede ejecutar local.

2. Semana 1 — Observabilidad primero (para que Azure “se vea”)
   - Instrumentar API Flask con Azure Application Insights (preferible vía OpenTelemetry) para logs, trazas y métricas.
   - Logging estructurado (JSON) + correlación (request id) para que en App Insights se vea la historia de una request: `/sensor_event` → Mongo insert → PG insert.
   - Definir SLOs de demo (p.ej. latencia p95 de `/registro_data`, tasa 5xx, disponibilidad de `/healthzdb`) y cómo medirlos en Azure.
   - Documentar consultas KQL “top 10” (errores, latencia por endpoint, requests por minuto, dependencias PG/Mongo).

3. Semana 2 — IaC con Bicep (el core del portafolio)
   - Crear un módulo `infra/` con Bicep que provisione (mínimo viable):
     - Resource Group
     - App Service Plan Linux
     - Web App API + settings (PG_CONN, MONGODB_URI vía Key Vault references, ALLOWED_ORIGINS)
     - Web App Frontend (o mantener el actual si ya está) + configuración
     - PostgreSQL Flexible Server + DB
     - Key Vault + secretos + RBAC para System Assigned Managed Identity de la Web App
     - Application Insights + Log Analytics workspace
   - Parametrizar por ambiente (`dev`/`prod`), región y nombres (evitar hardcode).
   - Dejar un `infra/README.md` con: prerequisitos, comandos de despliegue, y diagrama “qué crea cada módulo”.

4. Semana 3 — CI/CD y despliegue profesional (sin downtime)
   - GitHub Actions: separar jobs de build/test vs deploy (hoy solo build+deploy).
   - API: añadir deployment slot (staging), desplegar al slot, correr smoke tests contra el slot, y luego swap a prod.
   - Frontend: mantener despliegue simple, pero agregar verificación (build + checks) antes de publicar.
   - Secretos: mover credenciales de Azure a OIDC (federated credentials) si es viable; si no, documentar por qué se usa publish profile.

5. Semana 4 — Operación, seguridad y “demo story”
   - Azure Monitor alerts: 5xx rate, latencia alta, `/healthzdb` en 503, errores de dependencia (PG/Mongo).
   - Cost/story: explicar SKU elegido (B1/B2, Postgres Burstable) y tradeoffs; incluir estimación cualitativa y medidas de ahorro.
   - Hardening “mínimo creíble”: rate limiting en `/sensor_event`, control de exposición de `/admin/reset` (solo en dev/demo), timeouts/retries razonables.
   - Actualizar `arch_demo_deploy_az.mermaid` para reflejar la arquitectura real (y marcar Services Bus/Functions como “stretch goal” si se mantiene).
   - Preparar guion de demo (3–5 min): provision (IaC) → deploy → reset → simulación → dashboard en vivo → App Insights (trazas/errores/alertas).

6. Stretch goals (solo si sobra tiempo)
   - Azure Function Timer que genere eventos (reemplaza el simulador local) para mostrar serverless.
   - Endpoint agregado de resumen (campus/piso) si el polling empieza a pesar.

**Relevant files**
- api/app.py — CORS allowlist, rutas de ingesta/consulta, health endpoints.
- tools/seed_basics.py + tools/simulator.py — demo data y loop de eventos.
- frontend/src/App.tsx — polling/realtime UX.
- .github/workflows/* — CI/CD a evolucionar.
- arch_demo_deploy_az.mermaid + doc/implementation.md — documentación Azure existente a alinear.
- (a crear) infra/* — Bicep + README.

**Verification**
1. Observabilidad: ver requests, dependencias y errores en Application Insights mientras corre el simulador.
2. IaC: `az deployment` (o `az stack`) crea recursos desde cero; re-run es idempotente.
3. CI/CD: deploy a slot + smoke + swap sin downtime perceptible.
4. Demo end-to-end: reset → sim → dashboard reacciona; y todo queda trazado/medible en Azure.

**Decisions**
- Orientación: Infra/Azure primero (IaC + observabilidad + CI/CD).
- IaC: Bicep.
- AI/ML: fuera de scope por ahora (solo como opcional futuro).
