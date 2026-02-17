# S2vDB DB Ops Baseline Runbook (Dev)

## Purpose
Operational baseline for Stage 2 persistence on Azure SQL with Prisma migrations.

## Prerequisites
- Azure SQL server/database exists in Dev.
- Key Vault secret `SqlConnectionString--Dev` exists and contains a valid SQL Server connection string.
- Env values available:
  - `AZURE_KEY_VAULT_URI`
  - `SQL_CONNECTION_STRING_SECRET_NAME`

## 1) Resolve `DATABASE_URL` from Key Vault
```powershell
$env:AZURE_KEY_VAULT_URI="https://bomcomparex-kv-dev-001.vault.azure.net/"
$env:SQL_CONNECTION_STRING_SECRET_NAME="SqlConnectionString--Dev"

$kvName = ($env:AZURE_KEY_VAULT_URI -replace '^https://','' -replace '\.vault\.azure\.net/?$','')
$env:DATABASE_URL = az keyvault secret show --vault-name $kvName --name $env:SQL_CONNECTION_STRING_SECRET_NAME --query value -o tsv
if (-not $env:DATABASE_URL) { throw "DATABASE_URL not resolved from Key Vault." }
```

## 2) Deploy migrations
```powershell
cd apps/backend
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
cd ../..
```

## 3) Recover from failed migration (e.g., `P3018`)
```powershell
cd apps/backend
npx prisma migrate resolve --schema prisma/schema.prisma --rolled-back 202602170001_s2vdb_baseline
npx prisma migrate deploy --schema prisma/schema.prisma
cd ../..
```

## 4) Verify application baseline
```powershell
npm run verify:story
```

## 5) Rotate SQL connection secret
```powershell
$kvName="bomcomparex-kv-dev-001"
$sqlServerName="bomcomparedevsql01"
$dbName="bomcompareDev"
$sqlAdminUser="sqladminuser"
$sqlAdminPass="<NEW_PASSWORD>"
$conn="sqlserver://$sqlServerName.database.windows.net:1433;database=$dbName;user=$sqlAdminUser;password=$sqlAdminPass;encrypt=true;trustServerCertificate=false;connection timeout=30;"

az keyvault secret set --vault-name $kvName --name "SqlConnectionString--Dev" --value $conn
```

## 6) Known issues
- Prisma SQL Server migration files cannot include `GO` batch separators.
- `npm exec prisma ...` may misparse args; prefer `npx prisma ...` from `apps/backend`.
