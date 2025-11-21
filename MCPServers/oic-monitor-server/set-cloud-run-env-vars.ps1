<#
.SYNOPSIS
    Set environment variables for Cloud Run service

.DESCRIPTION
    This script helps you set environment variables for your Cloud Run OIC Monitor MCP Server.
    You can either set them from local environment variables or provide them directly.

.PARAMETER ShowCurrent
    Show current environment variable values

.PARAMETER OicClientId
    OIC Client ID

.PARAMETER OicClientSecret
    OIC Client Secret

.PARAMETER OicTokenUrl
    OIC Token URL

.PARAMETER OicApiBaseUrl
    OIC API Base URL

.PARAMETER OicIntegrationInstance
    OIC Integration Instance name

.PARAMETER OicScope
    OIC Scope (optional)

.EXAMPLE
    .\set-cloud-run-env-vars.ps1 -OicClientId "client-id" -OicClientSecret "secret"
    
.EXAMPLE
    # Set from local environment variables
    $env:OIC_CLIENT_ID = "client-id"
    $env:OIC_CLIENT_SECRET = "secret"
    .\set-cloud-run-env-vars.ps1

.EXAMPLE
    # Show current values
    .\set-cloud-run-env-vars.ps1 -ShowCurrent
#>

param(
    [switch]$ShowCurrent,
    
    [string]$OicClientId = "",
    [string]$OicClientSecret = "",
    [string]$OicTokenUrl = "",
    [string]$OicApiBaseUrl = "",
    [string]$OicIntegrationInstance = "",
    [string]$OicScope = ""
)

$ErrorActionPreference = "Stop"

$ProjectId = "aiagent-capstoneproject"
$Region = "us-central1"
$ServiceName = "oic-monitor-server"

# Handle ShowCurrent
if ($ShowCurrent) {
    Write-Host "Current environment variables for ${ServiceName}:" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $envVarsJson = gcloud run services describe $ServiceName --region $Region --format="json" --project $ProjectId 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -eq 0 -and $envVarsJson) {
            $envVars = $envVarsJson.spec.template.spec.containers[0].env
            
            if ($envVars -and $envVars.Count -gt 0) {
                $envVars | ForEach-Object {
                    $name = $_.name
                    $value = $_.value
                    # Mask sensitive values
                    if ($name -match "SECRET|PASSWORD|KEY" -and $value -and $value.Length -gt 4) {
                        $value = "***" + $value.Substring($value.Length - 4)
                    }
                    Write-Host "  $name = $value" -ForegroundColor Green
                }
            } else {
                Write-Host "  No environment variables set" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  Service not found or not accessible" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Could not retrieve environment variables" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    exit 0
}

Write-Host "Setting environment variables for $ServiceName..." -ForegroundColor Cyan
Write-Host ""

# Get values from parameters or environment
$clientId = if ($OicClientId) { $OicClientId } else { $env:OIC_CLIENT_ID }
$clientSecret = if ($OicClientSecret) { $OicClientSecret } else { $env:OIC_CLIENT_SECRET }
$tokenUrl = if ($OicTokenUrl) { $OicTokenUrl } else { $env:OIC_TOKEN_URL }
$apiBaseUrl = if ($OicApiBaseUrl) { $OicApiBaseUrl } else { $env:OIC_API_BASE_URL }
$integrationInstance = if ($OicIntegrationInstance) { $OicIntegrationInstance } else { $env:OIC_INTEGRATION_INSTANCE }
$scope = if ($OicScope) { $OicScope } else { $env:OIC_SCOPE }

# Build environment variable arguments
$envVars = @()

if ($clientId) {
    $envVars += "OIC_CLIENT_ID=$clientId"
    Write-Host "Setting OIC_CLIENT_ID" -ForegroundColor Green
} else {
    Write-Host "WARNING: OIC_CLIENT_ID not provided" -ForegroundColor Yellow
}

if ($clientSecret) {
    $envVars += "OIC_CLIENT_SECRET=$clientSecret"
    Write-Host "Setting OIC_CLIENT_SECRET" -ForegroundColor Green
} else {
    Write-Host "WARNING: OIC_CLIENT_SECRET not provided" -ForegroundColor Yellow
}

if ($tokenUrl) {
    $envVars += "OIC_TOKEN_URL=$tokenUrl"
    Write-Host "Setting OIC_TOKEN_URL" -ForegroundColor Green
} else {
    Write-Host "WARNING: OIC_TOKEN_URL not provided" -ForegroundColor Yellow
}

if ($apiBaseUrl) {
    $envVars += "OIC_API_BASE_URL=$apiBaseUrl"
    Write-Host "Setting OIC_API_BASE_URL" -ForegroundColor Green
} else {
    Write-Host "WARNING: OIC_API_BASE_URL not provided" -ForegroundColor Yellow
}

if ($integrationInstance) {
    $envVars += "OIC_INTEGRATION_INSTANCE=$integrationInstance"
    Write-Host "Setting OIC_INTEGRATION_INSTANCE" -ForegroundColor Green
} else {
    Write-Host "WARNING: OIC_INTEGRATION_INSTANCE not provided" -ForegroundColor Yellow
}

if ($scope) {
    $envVars += "OIC_SCOPE=$scope"
    Write-Host "Setting OIC_SCOPE" -ForegroundColor Green
}

if ($envVars.Count -eq 0) {
    Write-Host ""
    Write-Host "ERROR: No environment variables to set" -ForegroundColor Red
    Write-Host "Provide values via parameters or set environment variables" -ForegroundColor Yellow
    exit 1
}

# Update Cloud Run service
Write-Host ""
Write-Host "Updating Cloud Run service..." -ForegroundColor Cyan

$envVarsString = $envVars -join ","

$updateCmd = "gcloud run services update $ServiceName " +
              "--region $Region " +
              "--set-env-vars $envVarsString " +
              "--project $ProjectId"

Invoke-Expression $updateCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Environment variables updated successfully" -ForegroundColor Green
    
    # Get service URL
    $serviceUrl = gcloud run services describe $ServiceName --region $Region --format="value(status.url)" --project $ProjectId
    Write-Host ""
    Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan
    Write-Host "SSE Endpoint: $serviceUrl/sse" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test the service:" -ForegroundColor Yellow
    Write-Host "  Invoke-RestMethod -Uri `"$serviceUrl/health`"" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "ERROR: Failed to update environment variables" -ForegroundColor Red
    exit 1
}

