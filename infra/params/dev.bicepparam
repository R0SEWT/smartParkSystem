using '../main.bicep'

// Parámetros no sensibles para el ambiente dev.
// Secretos (postgresAdminPassword, mongodbUri, adminToken) se pasan por CLI.

param location = 'brazilsouth'
param environment = 'dev'

// Nombres alineados con los workflows (recomendado para demo reproducible)
param apiWebAppName = 'smartparksystemapi'
param frontendWebAppName = 'smartparksysten'

// Permite consumir la API desde el frontend Azure y desde localhost (útil para dev)
param allowedOrigins = 'https://smartparksysten.azurewebsites.net,http://localhost:5173'

param logRetentionDays = 30
