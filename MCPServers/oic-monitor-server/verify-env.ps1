<#
.SYNOPSIS
    Verify .env file has all required OIC credentials for all environments
#>

param(
    [string[]]$Environments = @("dev", "qa3", "prod1", "prod3")
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verify .env File Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envFile = Join-Path $ScriptDir ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "✗ .env file not found at: $envFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create it with:" -ForegroundColor Yellow
    Write-Host "  .\setup-env.ps1" -ForegroundColor White
    exit 1
}

Write-Host "✓ .env file found" -ForegroundColor Green
Write-Host ""

# Read .env file
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

Write-Host "Found $($envVars.Count) environment variables" -ForegroundColor Cyan
Write-Host ""

# Check each environment
$allGood = $true

foreach ($env in $Environments) {
    Write-Host "Environment: $env" -ForegroundColor Yellow
    
    $clientIdKey = "OIC_CLIENT_ID_$($env.ToUpper())"
    $clientSecretKey = "OIC_CLIENT_SECRET_$($env.ToUpper())"
    $tokenUrlKey = "OIC_TOKEN_URL_$($env.ToUpper())"
    
    $clientId = $envVars[$clientIdKey]
    $clientSecret = $envVars[$clientSecretKey]
    $tokenUrl = $envVars[$tokenUrlKey]
    
    $hasClientId = -not [string]::IsNullOrWhiteSpace($clientId)
    $hasClientSecret = -not [string]::IsNullOrWhiteSpace($clientSecret)
    $hasTokenUrl = -not [string]::IsNullOrWhiteSpace($tokenUrl)
    
    Write-Host "  $clientIdKey : $(if ($hasClientId) { '✓' } else { '✗ MISSING' })" -ForegroundColor $(if ($hasClientId) { "Green" } else { "Red" })
    Write-Host "  $clientSecretKey : $(if ($hasClientSecret) { '✓' } else { '✗ MISSING' })" -ForegroundColor $(if ($hasClientSecret) { "Green" } else { "Red" })
    Write-Host "  $tokenUrlKey : $(if ($hasTokenUrl) { '✓' } else { '✗ MISSING' })" -ForegroundColor $(if ($hasTokenUrl) { "Green" } else { "Red" })
    
    if (-not ($hasClientId -and $hasClientSecret -and $hasTokenUrl)) {
        $allGood = $false
        Write-Host ""
        Write-Host "  ⚠ Missing required variables for $env" -ForegroundColor Yellow
        Write-Host "  Run: .\setup-env.ps1 -Environment $env" -ForegroundColor White
    }
    
    Write-Host ""
}

if ($allGood) {
    Write-Host "✓ All required variables are configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If you're still getting errors:" -ForegroundColor Yellow
    Write-Host "  1. Rebuild: npm run build" -ForegroundColor White
    Write-Host "  2. Restart the server to load .env file" -ForegroundColor White
    Write-Host "  3. Check server logs for '✓ Loaded .env file' message" -ForegroundColor White
    Write-Host "  4. Verify .env file is in the correct location" -ForegroundColor White
} else {
    Write-Host "✗ Some required variables are missing" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix:" -ForegroundColor Yellow
    Write-Host "  .\setup-env.ps1" -ForegroundColor White
    Write-Host "  (Will prompt for missing values)" -ForegroundColor Gray
}

Write-Host ""

