# PowerShell script to deploy OIC Monitor MCP Server to Google Cloud Run
# Requires: gcloud CLI, Docker, and appropriate permissions

param(
    [string]$ProjectId = "aiagent-capstoneproject",
    [string]$Region = "us-central1",
    [string]$ServiceAccount = "",
    [switch]$BuildOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy OIC Monitor MCP Server to Cloud Run" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gcloud CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
} catch {
    Write-Host "ERROR: Docker is not running or not accessible" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Project: $ProjectId" -ForegroundColor White
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  Service: oic-monitor-server" -ForegroundColor White
Write-Host ""

# Set the project
Write-Host "Setting GCP project..." -ForegroundColor Cyan
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to set project" -ForegroundColor Red
    exit 1
}

# Enable required APIs
Write-Host "Enabling required APIs..." -ForegroundColor Cyan
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
Write-Host ""

# Check permissions
Write-Host "Checking permissions..." -ForegroundColor Cyan
$currentAccount = gcloud config get-value account 2>&1
Write-Host "  Authenticated as: $currentAccount" -ForegroundColor Gray
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Load environment variables from .env if it exists
$envFile = Join-Path $scriptDir ".env"
if (Test-Path $envFile) {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($value -match '^["''](.*)["'']$') {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host ""
}

# Prepare environment variables
$envVars = @()
$requiredVars = @("OIC_CLIENT_ID", "OIC_CLIENT_SECRET", "OIC_TOKEN_URL", "OIC_API_BASE_URL", "OIC_INTEGRATION_INSTANCE")
$optionalVars = @("OIC_SCOPE")

foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var, "Process")
    if ($value) {
        $envVars += "--set-env-vars=$var=$value"
    } else {
        Write-Host "WARNING: Required environment variable $var is not set" -ForegroundColor Yellow
    }
}

foreach ($var in $optionalVars) {
    $value = [Environment]::GetEnvironmentVariable($var, "Process")
    if ($value) {
        $envVars += "--set-env-vars=$var=$value"
    }
}

# Build the container image
Write-Host "Building container image..." -ForegroundColor Cyan
$image = "gcr.io/$ProjectId/oic-monitor-server:latest"
Write-Host "  Image: $image" -ForegroundColor Gray

gcloud builds submit --tag $image --project $ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Image built successfully" -ForegroundColor Green

if ($BuildOnly) {
    Write-Host "Build-only mode: Skipping deployment" -ForegroundColor Yellow
    exit 0
}

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Cyan

$deployCmd = "gcloud run deploy oic-monitor-server " +
             "--image $image " +
             "--platform managed " +
             "--region $Region " +
             "--allow-unauthenticated " +
             "--project $ProjectId"

if ($ServiceAccount) {
    $deployCmd += " --service-account $ServiceAccount"
}

if ($envVars.Count -gt 0) {
    $deployCmd += " " + ($envVars -join " ")
}

Invoke-Expression $deployCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] oic-monitor-server deployed successfully" -ForegroundColor Green
    
    # Get the service URL
    $serviceUrl = gcloud run services describe oic-monitor-server --region $Region --format="value(status.url)" --project $ProjectId
    Write-Host ""
    Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan
    Write-Host "SSE Endpoint: $serviceUrl/sse" -ForegroundColor Cyan
    Write-Host "Health Check: $serviceUrl/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Update your MCP client configuration:" -ForegroundColor Yellow
    Write-Host "  MCP_SERVER_URL=$serviceUrl/sse" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "To view deployed services:" -ForegroundColor Cyan
Write-Host "  gcloud run services list --region $Region --project $ProjectId" -ForegroundColor White
Write-Host ""

