using '../main.bicep'

// Parámetros no sensibles para el ambiente prod.
// Secretos (postgresAdminPassword, mongodbUri, adminToken) se pasan por CLI.
// Si necesitas desplegar dev y prod en paralelo, usa nombres distintos de Web Apps.

param location = 'brazilsouth'
param environment = 'prod'

param apiWebAppName = 'smartparksystemapi'
param frontendWebAppName = 'smartparksysten'

param allowedOrigins = 'https://smartparksysten.azurewebsites.net'

param logRetentionDays = 30
