<#
.SYNOPSIS
    Set environment variables for Docker deployment

.DESCRIPTION
    This script helps you set environment variables for the OIC Monitor MCP Server Docker container.
    You can either set them from local environment variables or provide them directly.

.PARAMETER UseEnvFile
    Create or update .env file instead of setting process environment variables

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
    .\set-docker-env-vars.ps1 -UseEnvFile -OicClientId "client-id" -OicClientSecret "secret"
    
.EXAMPLE
    # Set from local environment variables
    $env:OIC_CLIENT_ID = "client-id"
    $env:OIC_CLIENT_SECRET = "secret"
    .\set-docker-env-vars.ps1 -UseEnvFile
#>

param(
    [switch]$UseEnvFile,
    
    [string]$OicClientId = "",
    [string]$OicClientSecret = "",
    [string]$OicTokenUrl = "",
    [string]$OicApiBaseUrl = "",
    [string]$OicIntegrationInstance = "",
    [string]$OicScope = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Get values from parameters or environment
$clientId = if ($OicClientId) { $OicClientId } else { $env:OIC_CLIENT_ID }
$clientSecret = if ($OicClientSecret) { $OicClientSecret } else { $env:OIC_CLIENT_SECRET }
$tokenUrl = if ($OicTokenUrl) { $OicTokenUrl } else { $env:OIC_TOKEN_URL }
$apiBaseUrl = if ($OicApiBaseUrl) { $OicApiBaseUrl } else { $env:OIC_API_BASE_URL }
$integrationInstance = if ($OicIntegrationInstance) { $OicIntegrationInstance } else { $env:OIC_INTEGRATION_INSTANCE }
$scope = if ($OicScope) { $OicScope } else { $env:OIC_SCOPE }

if ($UseEnvFile) {
    # Create or update .env file
    $envFile = Join-Path $ScriptDir ".env"
    
    Write-Host "Creating/updating .env file..." -ForegroundColor Cyan
    Write-Host "  File: $envFile" -ForegroundColor Gray
    Write-Host ""
    
    $envContent = @()
    
    if ($clientId) {
        $envContent += "OIC_CLIENT_ID=$clientId"
        Write-Host "  Setting OIC_CLIENT_ID" -ForegroundColor Green
    }
    
    if ($clientSecret) {
        $envContent += "OIC_CLIENT_SECRET=$clientSecret"
        Write-Host "  Setting OIC_CLIENT_SECRET" -ForegroundColor Green
    }
    
    if ($tokenUrl) {
        $envContent += "OIC_TOKEN_URL=$tokenUrl"
        Write-Host "  Setting OIC_TOKEN_URL" -ForegroundColor Green
    }
    
    if ($apiBaseUrl) {
        $envContent += "OIC_API_BASE_URL=$apiBaseUrl"
        Write-Host "  Setting OIC_API_BASE_URL" -ForegroundColor Green
    }
    
    if ($integrationInstance) {
        $envContent += "OIC_INTEGRATION_INSTANCE=$integrationInstance"
        Write-Host "  Setting OIC_INTEGRATION_INSTANCE" -ForegroundColor Green
    }
    
    if ($scope) {
        $envContent += "OIC_SCOPE=$scope"
        Write-Host "  Setting OIC_SCOPE" -ForegroundColor Green
    }
    
    # Add PORT if not present
    if (-not ($envContent | Where-Object { $_ -match "^PORT=" })) {
        $envContent += "PORT=3000"
    }
    
    # Write to file
    $envContent | Out-File -FilePath $envFile -Encoding utf8 -Force
    
    Write-Host ""
    Write-Host "✓ .env file created/updated" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  .\deploy-to-docker-desktop.ps1" -ForegroundColor Gray
    Write-Host ""
} else {
    # Set process environment variables
    Write-Host "Setting process environment variables..." -ForegroundColor Cyan
    Write-Host ""
    
    if ($clientId) {
        [Environment]::SetEnvironmentVariable("OIC_CLIENT_ID", $clientId, "Process")
        Write-Host "  OIC_CLIENT_ID set" -ForegroundColor Green
    }
    
    if ($clientSecret) {
        [Environment]::SetEnvironmentVariable("OIC_CLIENT_SECRET", $clientSecret, "Process")
        Write-Host "  OIC_CLIENT_SECRET set" -ForegroundColor Green
    }
    
    if ($tokenUrl) {
        [Environment]::SetEnvironmentVariable("OIC_TOKEN_URL", $tokenUrl, "Process")
        Write-Host "  OIC_TOKEN_URL set" -ForegroundColor Green
    }
    
    if ($apiBaseUrl) {
        [Environment]::SetEnvironmentVariable("OIC_API_BASE_URL", $apiBaseUrl, "Process")
        Write-Host "  OIC_API_BASE_URL set" -ForegroundColor Green
    }
    
    if ($integrationInstance) {
        [Environment]::SetEnvironmentVariable("OIC_INTEGRATION_INSTANCE", $integrationInstance, "Process")
        Write-Host "  OIC_INTEGRATION_INSTANCE set" -ForegroundColor Green
    }
    
    if ($scope) {
        [Environment]::SetEnvironmentVariable("OIC_SCOPE", $scope, "Process")
        Write-Host "  OIC_SCOPE set" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✓ Environment variables set for current session" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: These will only persist for this PowerShell session." -ForegroundColor Yellow
    Write-Host "Use -UseEnvFile to create a .env file for persistence." -ForegroundColor Yellow
    Write-Host ""
}

