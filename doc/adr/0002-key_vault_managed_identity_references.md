# ADR 0002: Key Vault + Managed Identity + Key Vault References

- Estado: Accepted
- Fecha: 2026-04-09

## Contexto
El backend requiere secretos/configuración sensible (por ejemplo `PG_CONN`, `MONGODB_URI`, `ADMIN_TOKEN`). En Azure App Service no es deseable:
- Guardarlos en el repositorio.
- Dejarlos en claro en App Settings o en scripts de despliegue.

## Decisión
- Usar **System Assigned Managed Identity** (MI) en la Web App.
- Guardar secretos en **Azure Key Vault**.
- Consumir secretos vía **Key Vault References** (App Settings con `@Microsoft.KeyVault(...)`).
- Gestionar permisos con **RBAC**, asignando a la MI el rol **Key Vault Secrets User**.

## Consecuencias
- (+) Los secretos no viven en el código y se rotan de forma centralizada.
- (+) Menos riesgo de exposición accidental en logs/pipelines.
- (-) La app depende de permisos/configuración correctos para arrancar (fallos de RBAC o referencias rompen el runtime).

## Alternativas consideradas
- App Settings en claro.
- Inyección de secretos desde el pipeline en deploy.
- Azure App Configuration (con Key Vault references).

## Referencias
- [infra/main.bicep](../../infra/main.bicep)
- [infra/README.md](../../infra/README.md)
- [doc/implementation.md](../implementation.md)
