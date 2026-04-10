# ADR 0004: Infraestructura como código (Bicep)

- Estado: Accepted
- Fecha: 2026-04-09

## Contexto
El despliegue manual con CLI es útil como referencia, pero no garantiza reproducibilidad ni idempotencia. Para un repo orientado a portafolio, la infraestructura debe ser revisable y repetible.

## Decisión
- Mantener la infraestructura mínima del demo definida en Bicep dentro de `infra/`.
- Publicar prerequisitos, comandos y notas de seguridad en `infra/README.md`.

## Consecuencias
- (+) Provisionamiento reproducible e idempotente.
- (+) Facilita code review y evolución mediante PRs.
- (-) Hay que mantener el Bicep alineado con cambios de runtime/config.

## Alternativas consideradas
- Terraform.
- ARM templates.
- Despliegue manual con `az` (documentado como alternativa).

## Referencias
- [infra/main.bicep](../../infra/main.bicep)
- [infra/README.md](../../infra/README.md)
- [doc/implementation.md](../implementation.md)
