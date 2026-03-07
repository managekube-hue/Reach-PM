# deploy.ps1 - Usage: .\deploy.ps1 -ProjectRef oaykcvlxerklcwcmbbge
param([Parameter(Mandatory)][string]$ProjectRef)
Set-Location $PSScriptRoot
Write-Host "=== REACH Deploy ===" -ForegroundColor Cyan
Write-Host "[1/3] Linking project..." -ForegroundColor Yellow
npx supabase link --project-ref $ProjectRef
Write-Host "[2/3] Pushing migrations..." -ForegroundColor Yellow
npx supabase db push
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: migrations failed" -ForegroundColor Red; exit 1 }
Write-Host "  OK migrations" -ForegroundColor Green
if (Test-Path ".env.backend") {
  Write-Host "[2b] Setting secrets..." -ForegroundColor Yellow
  npx supabase secrets set --env-file .env.backend
}
Write-Host "[3/3] Deploying functions..." -ForegroundColor Yellow
@("comm-send-message","comm-open-dm","comm-set-presence","comm-presence-heartbeat","comm-presence-snapshot","comm-schedule-meeting","comm-meeting-rsvp","comm-command-router") | ForEach-Object {
  npx supabase functions deploy $_ --no-verify-jwt
  if ($LASTEXITCODE -eq 0) { Write-Host "  OK $_" -ForegroundColor Green } else { Write-Host "  FAIL $_" -ForegroundColor Red }
}
Write-Host "=== Done ===" -ForegroundColor Cyan