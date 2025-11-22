# PowerShell script to deploy MonitorQueueRequestAgent using Application Default Credentials (ADC)
# Uses your user account credentials (from gcloud auth)
# Run this script from the MonitorQueueRequestAgent directory

$agentName = "MonitorQueueRequestAgent"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $agentDir)

# Navigate to agent directory (current script location)
Set-Location $agentDir
Write-Host "Deploying $agentName using Application Default Credentials (ADC)..." -ForegroundColor Green
Write-Host "  Agent directory: $agentDir" -ForegroundColor Cyan
Write-Host "  Config file: .agent_engine_config.json" -ForegroundColor Cyan
Write-Host ""

# Unset GOOGLE_APPLICATION_CREDENTIALS to force use of ADC
if ($env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "Note: GOOGLE_APPLICATION_CREDENTIALS is set, unsetting to use ADC" -ForegroundColor Yellow
    Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS
    Write-Host ""
}

# Check if user is authenticated with gcloud
Write-Host "Checking authentication..." -ForegroundColor Cyan
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if ($LASTEXITCODE -ne 0 -or -not $authCheck) {
    Write-Host "WARNING: No active gcloud authentication found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run one of these first:" -ForegroundColor Yellow
    Write-Host "  gcloud auth application-default login" -ForegroundColor Cyan
    Write-Host "  OR" -ForegroundColor Yellow
    Write-Host "  gcloud auth login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Active account: $authCheck" -ForegroundColor Green
Write-Host ""

# Set the quota project for ADC to use the correct project
Write-Host "Setting ADC quota project..." -ForegroundColor Cyan
$quotaProject = if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { "aiagent-capstoneproject" }
Write-Host "  Setting quota project to: $quotaProject" -ForegroundColor White
gcloud auth application-default set-quota-project $quotaProject 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Quota project set to: $quotaProject" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Warning: Could not set quota project (may need permissions)" -ForegroundColor Yellow
}
Write-Host ""

# Load environment variables from .env if it exists
$envFiles = @(
    ".env",
    "$projectRoot\.env"
)
foreach ($envFile in $envFiles) {
    if (Test-Path $envFile) {
        Write-Host "Loading environment variables from $envFile..." -ForegroundColor Cyan
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
        break
    }
}

# Get project and region from environment or use defaults
$projectId = if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { "aiagent-capstoneproject" }
$region = if ($env:GOOGLE_CLOUD_LOCATION) { $env:GOOGLE_CLOUD_LOCATION } else { "us-central1" }

Write-Host "Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  Agent: $agentName" -ForegroundColor White
Write-Host "  Project: $projectId" -ForegroundColor White
Write-Host "  Region: $region" -ForegroundColor White
Write-Host "  Authentication: ADC (User Account: $authCheck)" -ForegroundColor White
Write-Host ""

# Verify config file exists
if (-not (Test-Path ".agent_engine_config.json")) {
    Write-Host "ERROR: Config file not found: .agent_engine_config.json" -ForegroundColor Red
    exit 1
}

# Deploy using ADK
# ADK automatically uses agent.name from agent.py (should be "MonitorQueueRequestAgent")
Write-Host "Running deployment command..." -ForegroundColor Green
Write-Host ""
adk deploy agent_engine --project=$projectId --region=$region . --agent_engine_config_file=.agent_engine_config.json

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ $agentName deployed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✗ $agentName deployment failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

