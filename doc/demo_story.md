# Demo story (3–5 min)

Volver al hub: [doc/README.md](README.md)

Objetivo: contar una historia clara de “Azure + observabilidad + datos en vivo” en pocos minutos.

## Guion
1. **Arquitectura (30s)**
   - Enseña el diagrama: [arch_demo_deploy_az.mermaid](../arch_demo_deploy_az.mermaid).
   - Mensaje: Frontend SPA → API Flask → Postgres (canónico + PostGIS) + Mongo (eventos crudos).

2. **Provisionamiento reproducible (45s)**
   - Abrir [infra/README.md](../infra/README.md) y señalar que todo se crea con Bicep.
   - Ejecutar/mostrar el comando `az deployment group create` con `infra/params/dev.bicepparam`.

3. **Deploy (30–45s)**
   - Mostrar GitHub Actions:
     - API: [.github/workflows/api-appservice.yml](../.github/workflows/api-appservice.yml)
     - Frontend: [.github/workflows/frontend-appservice.yml](../.github/workflows/frontend-appservice.yml)
   - Mensaje: antes de deploy se corren smoke tests.

4. **Reset + datos en vivo (60–90s)**
   - `POST /admin/reset` (opcional) para demo determinista.
   - Correr el simulador y mostrar que el dashboard se actualiza.

5. **Observabilidad (60s)**
   - Abrir Application Insights.
   - Mostrar requests, errores (si forzas uno), dependencias.
   - Mostrar correlación con `X-Request-ID`.
   - Referencia: [doc/observability.md](observability.md).

## Enlaces rápidos
- Runbook paso a paso: [doc/runbook_demo.md](runbook_demo.md)
- Despliegue Azure (manual/Bicep): [doc/implementation.md](implementation.md)
