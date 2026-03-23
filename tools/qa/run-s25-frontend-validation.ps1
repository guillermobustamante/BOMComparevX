param(
  [switch]$IncludePerfProfile
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$ShellCommand
  )

  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Cyan
  Write-Host $ShellCommand -ForegroundColor DarkGray
  & ([ScriptBlock]::Create($ShellCommand))
}

Invoke-Step -Name "Frontend typecheck" -ShellCommand "npm --prefix apps/frontend run typecheck"
Invoke-Step -Name "Frontend build" -ShellCommand "npm --prefix apps/frontend run build"
Invoke-Step -Name "Navigation and workspace regression suite" -ShellCommand "npx playwright test tests/e2e/navigation-redesign.spec.ts tests/e2e/results-redesign.spec.ts tests/e2e/auth-shell.spec.ts --grep `"navigation redesign|results redesign|history page supports rename, tag, and soft-delete actions|notifications page shows comparison outcome entries with result links|admin page supports user search and upload policy override/reset for admins|authenticated user can load upload shell`""
Invoke-Step -Name "Results interaction performance benchmark" -ShellCommand "npx playwright test tests/e2e/results-interaction-perf.spec.ts"

if ($IncludePerfProfile) {
  Invoke-Step -Name "Live frontend profile" -ShellCommand "`$env:PERF_PROFILE_V1='true'; npx playwright test tests/e2e/perf-profile.spec.ts"
}

Write-Host ""
Write-Host "S25 frontend validation completed." -ForegroundColor Green
