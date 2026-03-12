param(
  [string]$VaultName = "bomcomparex-kv-dev-001",
  [string]$SecretName = "SqlConnectionString--Dev",
  [ValidateSet("validate", "migrate-dev", "migrate-deploy", "generate", "start-dev", "start", "ci", "dev-setup")]
  [string]$Action = "dev-setup",
  [string]$MigrationName = "s15_change_intelligence_taxonomy"
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Write-Host ""
  Write-Host ">> $Command" -ForegroundColor Cyan
  Invoke-Expression $Command
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendRoot = Join-Path $repoRoot "apps/backend"

Write-Host "Resolving DATABASE_URL from Azure Key Vault..." -ForegroundColor Yellow
$env:DATABASE_URL = az keyvault secret show --vault-name $VaultName --name $SecretName --query value -o tsv

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  throw "DATABASE_URL was not returned from Azure Key Vault. Check az login, vault access, and secret name."
}

Write-Host "DATABASE_URL loaded from vault '$VaultName' secret '$SecretName'." -ForegroundColor Green

Push-Location $backendRoot
try {
  switch ($Action) {
    "validate" {
      Invoke-Step "npx prisma validate"
    }
    "migrate-dev" {
      Invoke-Step "npx prisma validate"
      Invoke-Step "npx prisma migrate dev --name $MigrationName"
      Invoke-Step "npx prisma generate"
    }
    "migrate-deploy" {
      Invoke-Step "npx prisma validate"
      Invoke-Step "npx prisma migrate deploy"
      Invoke-Step "npx prisma generate"
    }
    "generate" {
      Invoke-Step "npx prisma generate"
    }
    "start-dev" {
      Invoke-Step "npm run start:dev"
    }
    "start" {
      Invoke-Step "npm run start"
    }
    "ci" {
      Invoke-Step "npm run ci"
    }
    "dev-setup" {
      Invoke-Step "npx prisma validate"
      Invoke-Step "npx prisma migrate dev --name $MigrationName"
      Invoke-Step "npx prisma generate"
      Write-Host ""
      Write-Host "Dev database is ready. Start the backend with:" -ForegroundColor Green
      Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\bootstrap-backend-from-keyvault.ps1 -Action start-dev"
    }
  }
}
finally {
  Pop-Location
}
