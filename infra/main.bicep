targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Short prefix for resource names (lowercase recommended)')
param namePrefix string = 'smartpark'

@allowed([
  'dev'
  'prod'
])
@description('Deployment environment')
param environment string = 'dev'

@description('App Service Plan name')
param appServicePlanName string = '${namePrefix}-${environment}-plan'

@description('Backend Web App name (must be globally unique)')
param apiWebAppName string = 'smartparksystemapi'

@description('Frontend Web App name (must be globally unique)')
param frontendWebAppName string = 'smartparksysten'

@description('Key Vault name (must be globally unique, 3-24 chars, alphanumerics only)')
param keyVaultName string = '${toLower(replace(namePrefix, '-', ''))}${environment}kv${substring(uniqueString(resourceGroup().id), 0, 6)}'

@description('PostgreSQL Flexible Server name (must be globally unique)')
param postgresServerName string = '${namePrefix}-${environment}-pg-${substring(uniqueString(resourceGroup().id), 0, 6)}'

@description('PostgreSQL admin user')
param postgresAdminUser string = 'pgadmin'

@secure()
@description('PostgreSQL admin password')
param postgresAdminPassword string

@description('PostgreSQL database name')
param postgresDbName string = 'smartpark'

@secure()
@description('MongoDB connection string (e.g. Atlas URI)')
param mongodbUri string

@secure()
@description('Admin token for /admin/reset (demo only)')
param adminToken string

@description('CORS allowlist (comma-separated origins)')
param allowedOrigins string = 'https://${frontendWebAppName}.azurewebsites.net'

@description('Retention (days) for Log Analytics')
param logRetentionDays int = 30

var kvUri = 'https://${keyVaultName}.vault.azure.net/'

// ---------- Observability ----------
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namePrefix}-${environment}-law-${substring(uniqueString(resourceGroup().id), 0, 6)}'
  location: location
  properties: {
    retentionInDays: logRetentionDays
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-${environment}-appi-${substring(uniqueString(resourceGroup().id), 0, 6)}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
  }
}

// ---------- Data (PostgreSQL Flexible Server) ----------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 64
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  name: '${postgres.name}/${postgresDbName}'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Demo-friendly (NOT for production): allow all public IPs.
resource postgresFirewallAllowAll 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  name: '${postgres.name}/allow-all'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

var pgConn = 'postgresql://${postgresAdminUser}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDbName}?sslmode=require'

// ---------- Security (Key Vault + secrets) ----------
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
  }
}

resource secretPgConn 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.name}/PG_CONN'
  properties: {
    value: pgConn
  }
}

resource secretMongo 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.name}/MONGODB_URI'
  properties: {
    value: mongodbUri
  }
}

resource secretAdminToken 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.name}/ADMIN_TOKEN'
  properties: {
    value: adminToken
  }
}

// ---------- Compute (App Service) ----------
resource appPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource apiApp 'Microsoft.Web/sites@2022-09-01' = {
  name: apiWebAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.10'
      appCommandLine: './startup.sh'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: '1'
        }
        {
          name: 'PG_CONN'
          value: '@Microsoft.KeyVault(SecretUri=${kvUri}secrets/PG_CONN/)'
        }
        {
          name: 'MONGODB_URI'
          value: '@Microsoft.KeyVault(SecretUri=${kvUri}secrets/MONGODB_URI/)'
        }
        {
          name: 'ADMIN_TOKEN'
          value: '@Microsoft.KeyVault(SecretUri=${kvUri}secrets/ADMIN_TOKEN/)'
        }
        {
          name: 'ALLOWED_ORIGINS'
          value: allowedOrigins
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}

resource frontendApp 'Microsoft.Web/sites@2022-09-01' = {
  name: frontendWebAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      // Serve SPA static assets deployed to /home/site/wwwroot
      appCommandLine: 'pm2 serve /home/site/wwwroot 8080 --no-daemon --spa'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: '0'
        }
      ]
    }
  }
}

// RBAC: allow the API Web App to read Key Vault secrets.
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource kvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiApp.identity.principalId, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output frontendUrl string = 'https://${frontendApp.properties.defaultHostName}'
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output keyVaultVaultUri string = kvUri
output appInsightsName string = appInsights.name
