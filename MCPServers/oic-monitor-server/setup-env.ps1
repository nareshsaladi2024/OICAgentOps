<#
.SYNOPSIS
    Setup .env file with all OIC environment credentials

.DESCRIPTION
    Creates or updates .env file with environment-specific OIC credentials.
    Supports: dev, qa3, prod1, prod3

.PARAMETER Environment
    Specific environment to configure (dev, qa3, prod1, prod3). If not specified, prompts for all.

.EXAMPLE
    .\setup-env.ps1
    .\setup-env.ps1 -Environment prod3
#>

param(
    [ValidateSet("dev", "qa3", "prod1", "prod3")]
    [string]$Environment = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$envFile = Join-Path $ScriptDir ".env"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OIC Monitor Server - Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Environments to configure
$environments = if ($Environment) { @($Environment) } else { @("dev", "qa3", "prod1", "prod3") }

# Read existing .env file if it exists
$existingEnv = @{}
if (Test-Path $envFile) {
    Write-Host "Reading existing .env file..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $existingEnv[$key] = $value
        }
    }
    Write-Host "Found $($existingEnv.Count) existing variables" -ForegroundColor Green
    Write-Host ""
}

# Collect credentials for each environment
$newEnvVars = @{}

foreach ($env in $environments) {
    Write-Host "Configuring environment: $env" -ForegroundColor Yellow
    Write-Host ""
    
    # Check if already configured
    $clientIdKey = "OIC_CLIENT_ID_$($env.ToUpper())"
    $clientSecretKey = "OIC_CLIENT_SECRET_$($env.ToUpper())"
    $tokenUrlKey = "OIC_TOKEN_URL_$($env.ToUpper())"
    $apiBaseUrlKey = "OIC_API_BASE_URL_$($env.ToUpper())"
    $scopeKey = "OIC_SCOPE_$($env.ToUpper())"
    $integrationInstanceKey = "OIC_INTEGRATION_INSTANCE_$($env.ToUpper())"
    
    # Client ID
    if ($existingEnv.ContainsKey($clientIdKey)) {
        Write-Host "  $clientIdKey = [EXISTING]" -ForegroundColor Gray
        $newEnvVars[$clientIdKey] = $existingEnv[$clientIdKey]
    } else {
        $value = Read-Host "  Enter $clientIdKey"
        if ($value) {
            $newEnvVars[$clientIdKey] = $value
        }
    }
    
    # Client Secret
    if ($existingEnv.ContainsKey($clientSecretKey)) {
        Write-Host "  $clientSecretKey = [EXISTING]" -ForegroundColor Gray
        $newEnvVars[$clientSecretKey] = $existingEnv[$clientSecretKey]
    } else {
        $value = Read-Host "  Enter $clientSecretKey" -AsSecureString
        if ($value) {
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
            $plainValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
            $newEnvVars[$clientSecretKey] = $plainValue
        }
    }
    
    # Token URL
    if ($existingEnv.ContainsKey($tokenUrlKey)) {
        Write-Host "  $tokenUrlKey = [EXISTING]" -ForegroundColor Gray
        $newEnvVars[$tokenUrlKey] = $existingEnv[$tokenUrlKey]
    } else {
        $defaultTokenUrl = "https://your-instance-$env.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token"
        Write-Host "  Enter $tokenUrlKey (default: $defaultTokenUrl)" -ForegroundColor Gray
        $value = Read-Host "  $tokenUrlKey"
        if ($value) {
            $newEnvVars[$tokenUrlKey] = $value
        } elseif (-not $existingEnv.ContainsKey($tokenUrlKey)) {
            $newEnvVars[$tokenUrlKey] = $defaultTokenUrl
        }
    }
    
    # API Base URL (optional)
    if ($existingEnv.ContainsKey($apiBaseUrlKey)) {
        $newEnvVars[$apiBaseUrlKey] = $existingEnv[$apiBaseUrlKey]
    } else {
        $defaultApiUrl = "https://your-instance-$env.integration.ocp.oc-test.com/ic/api/integration/v1"
        Write-Host "  Enter $apiBaseUrlKey (optional, default: $defaultApiUrl)" -ForegroundColor Gray
        $value = Read-Host "  $apiBaseUrlKey"
        if ($value) {
            $newEnvVars[$apiBaseUrlKey] = $value
        } elseif (-not $existingEnv.ContainsKey($apiBaseUrlKey)) {
            $newEnvVars[$apiBaseUrlKey] = $defaultApiUrl
        }
    }
    
    # Scope (optional)
    if ($existingEnv.ContainsKey($scopeKey)) {
        $newEnvVars[$scopeKey] = $existingEnv[$scopeKey]
    } else {
        Write-Host "  Enter $scopeKey (optional, press Enter to skip)" -ForegroundColor Gray
        $value = Read-Host "  $scopeKey"
        if ($value) {
            $newEnvVars[$scopeKey] = $value
        }
    }
    
    # Integration Instance (optional)
    if ($existingEnv.ContainsKey($integrationInstanceKey)) {
        $newEnvVars[$integrationInstanceKey] = $existingEnv[$integrationInstanceKey]
    } else {
        Write-Host "  Enter $integrationInstanceKey (optional, press Enter to skip)" -ForegroundColor Gray
        $value = Read-Host "  $integrationInstanceKey"
        if ($value) {
            $newEnvVars[$integrationInstanceKey] = $value
        }
    }
    
    Write-Host ""
}

# Merge with existing env vars (keep ones not being updated)
foreach ($key in $existingEnv.Keys) {
    if (-not $newEnvVars.ContainsKey($key)) {
        $newEnvVars[$key] = $existingEnv[$key]
    }
}

# Write .env file
Write-Host "Writing .env file..." -ForegroundColor Cyan
$envContent = @"
# OIC Monitor Server Environment Variables
# Generated by setup-env.ps1
# 
# Environment-specific credentials
# Format: OIC_CLIENT_ID_<ENV>, OIC_CLIENT_SECRET_<ENV>, OIC_TOKEN_URL_<ENV>
# Supported environments: dev, qa3, prod1, prod3

"@

# Sort keys for better readability
$sortedKeys = $newEnvVars.Keys | Sort-Object

foreach ($key in $sortedKeys) {
    $envContent += "$key=$($newEnvVars[$key])`n"
}

Set-Content -Path $envFile -Value $envContent -NoNewline

Write-Host ""
Write-Host "✓ .env file created/updated: $envFile" -ForegroundColor Green
Write-Host ""
Write-Host "Configured environments:" -ForegroundColor Cyan
foreach ($env in $environments) {
    $clientIdKey = "OIC_CLIENT_ID_$($env.ToUpper())"
    if ($newEnvVars.ContainsKey($clientIdKey) -and $newEnvVars[$clientIdKey]) {
        Write-Host "  ✓ $env" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ $env (incomplete)" -ForegroundColor Yellow
    }
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review .env file and update values if needed" -ForegroundColor White
Write-Host "  2. Restart the server to load new environment variables" -ForegroundColor White
Write-Host "  3. Test with: monitoringInstances tool with environment=$($environments[0])" -ForegroundColor White
Write-Host ""



