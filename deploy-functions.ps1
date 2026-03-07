# Deploy all edge functions to Supabase
Write-Host "Deploying edge functions..." -ForegroundColor Cyan

$functions = @(
    "comm-send-message",
    "comm-command-router",
    "comm-open-dm",
    "comm-set-presence",
    "comm-presence-heartbeat",
    "comm-presence-snapshot",
    "comm-schedule-meeting",
    "comm-meeting-rsvp",
    "comm-admin-create-user"
)

foreach ($func in $functions) {
    Write-Host "Deploying $func..." -ForegroundColor Yellow
    npx supabase functions deploy $func --no-verify-jwt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to deploy $func" -ForegroundColor Red
        exit 1
    }
}

Write-Host "All functions deployed successfully!" -ForegroundColor Green
