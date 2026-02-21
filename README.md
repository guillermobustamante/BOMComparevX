# BOM Compare VX

Execution baseline for Stage 1 with selected stack:
- Next.js frontend
- NestJS backend
- MSAL/Passport auth
- Prisma + Azure SQL

## Current Execution Scope
- S1-09: Identity provider provisioning and secret management foundations.
- S1-01/S1-02 backend auth scaffolding for Google and Microsoft callbacks.
- S1-06 frontend responsive authenticated shell (`/upload`, `/history`, `/login`).
- CI checks for env/documentation contracts and backend typecheck/build.

## Quick Start (Current Baseline)
1. Copy `.env.example` to `.env.local` for local development values.
2. Follow `docs/runbooks/s1-09-idp-keyvault-dev-setup.md` to provision Dev OAuth and Key Vault secrets.
3. Install backend dependencies: `npm install --prefix apps/backend`.
4. Install frontend dependencies: `npm install --prefix apps/frontend`.
5. Run `npm run ci:checks`.
6. Start backend: `npm --prefix apps/backend run start:dev`.
7. Start frontend: `npm --prefix apps/frontend run dev`.
8. Push branch to trigger CI.

## Automated Verification
- Run full local verification after a story:
`npm run verify:story`
- This executes:
`ci:checks` (contracts + backend + frontend build checks) and Playwright browser tests.

## Stage 4 Real XLSX Regression Runbook

Supported ingestion parser behavior:
- `.csv`: parsed via CSV parser.
- `.xlsx` / `.xls`: parsed via workbook parser (first sheet, deterministic row order).
- Corrupt/unsupported parse paths fail fast with structured error codes and `correlationId`.

Locked regression fixtures:
- `tests/fixtures/stage4/bill-of-materials.xlsx`
- `tests/fixtures/stage4/bill-of-materialsv2.xlsx`

Browser validation flow:
1. Start app stack:
   - `npm --prefix apps/backend run start:dev`
   - `npm --prefix apps/frontend run dev`
2. Sign in and open `/upload`.
3. Upload fixture A/B above and click `Queue Job`.
4. Click `View Results`.
5. Verify results show part `3023` as `modified` with changed fields including `color`, `quantity`, and `cost`.

Automation hooks:
- Backend e2e regression: `apps/backend/test/stage1.e2e-spec.ts`
- Playwright regression: `tests/e2e/auth-shell.spec.ts`

## Azure SQL + Key Vault Dev Setup (S2-00 Baseline)
Use this when provisioning durable DB persistence for Dev.
For ongoing DB operations (deploy/recover/rotate), use:
`docs/runbooks/s2vdb-db-ops-baseline.md`.

### 1) Set Azure subscription
```powershell
az account set --subscription 5ce30dc6-7731-4317-8540-060abd50d943
```

### 2) Create SQL Server + Database
```powershell
$rg="PLMChanges"
$location="eastus"
$sqlServerName="bomcomparedevsql01"   # must be globally unique
$sqlAdminUser="dbplatformowner"
$sqlAdminPass="<STRONG_PASSWORD>"
$dbName="bomcompareDev"

az sql server create `
  --name $sqlServerName `
  --resource-group $rg `
  --location $location `
  --admin-user $sqlAdminUser `
  --admin-password $sqlAdminPass

az sql db create `
  --resource-group $rg `
  --server $sqlServerName `
  --name $dbName `
  --service-objective S0
```

### 3) Add firewall rule for current public IP
```powershell
$myIp=(Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
az sql server firewall-rule create `
  --resource-group $rg `
  --server $sqlServerName `
  --name "DevMachine" `
  --start-ip-address $myIp `
  --end-ip-address $myIp
```

### 4) Build SQL connection string
```powershell
$sqlHost="$sqlServerName.database.windows.net"
$conn="sqlserver://$sqlHost:1433;database=$dbName;user=$sqlAdminUser;password=$sqlAdminPass;encrypt=true;trustServerCertificate=false;connection timeout=30;"
$conn
```

### 5) Store connection string in Key Vault
```powershell
$kvName="<your-keyvault-name>"
az keyvault secret set --vault-name $kvName --name "SqlConnectionString--Dev" --value $conn
az keyvault secret show --vault-name $kvName --name "SqlConnectionString--Dev" --query id -o tsv
```

### 6) Env/secret-name contract (current)
Add these keys to `.env.local` for DB secret resolution once S2-00 code wiring lands:
```dotenv
SQL_CONNECTION_STRING_SECRET_NAME=SqlConnectionString--Dev
DATABASE_URL=
```

Notes:
- `DATABASE_URL` is optional local fallback for non-Key-Vault runs.
- Do not commit real DB credentials or connection strings.
