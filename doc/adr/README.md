# ADRs (Architecture Decision Records)

Los ADRs capturan decisiones técnicas importantes del proyecto, con su contexto y consecuencias. Son “doc-as-code”: viven en el repo y evolucionan con PRs.

## Convenciones
- Ubicación: `doc/adr/`
- Nombre: `0001-titulo_corto.md` (secuencial, 4 dígitos)
- Template: [0000-template.md](0000-template.md)
- Estados:
  - **Proposed**: en discusión.
  - **Accepted**: vigente.
  - **Deprecated**: ya no se recomienda (sin reemplazo directo).
  - **Superseded**: reemplazado por otro ADR (indicar cuál).

## Cómo crear uno nuevo
1. Copia el template a un nuevo número (`0005-...`).
2. Describe contexto, decisión y consecuencias (incluye riesgos).
3. Enlaza artefactos reales (código, Bicep, docs).
4. Si reemplaza una decisión anterior, marca “Supersedes” y actualiza el ADR viejo como “Superseded”.

## Índice
- [ADR 0001: Persistencia dual (PostgreSQL + MongoDB)](0001-polyglot_persistence_postgres_mongo.md)
- [ADR 0002: Key Vault + Managed Identity + Key Vault References](0002-key_vault_managed_identity_references.md)
- [ADR 0003: Observabilidad (App Insights + OpenTelemetry)](0003-observability_app_insights_opentelemetry.md)
- [ADR 0004: Infraestructura como código (Bicep)](0004-infra_as_code_bicep.md)
