# PowerShell script to deploy MonitorQueueRequestAgent using Service Account credentials
# Run this script from the MonitorQueueRequestAgent directory

$agentName = "MonitorQueueRequestAgent"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $agentDir)

# Navigate to agent directory
Set-Location $agentDir
Write-Host "Deploying $agentName using Service Account..." -ForegroundColor Green
Write-Host "  Agent directory: $agentDir" -ForegroundColor Cyan
Write-Host ""

# Check for service account key file
if (-not $env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "ERROR: GOOGLE_APPLICATION_CREDENTIALS environment variable not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set it to your service account key file:" -ForegroundColor Yellow
    Write-Host "  `$env:GOOGLE_APPLICATION_CREDENTIALS = 'path\to\service-account-key.json'" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

if (-not (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS)) {
    Write-Host "ERROR: Service account key file not found: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Red
    exit 1
}

Write-Host "Using service account: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Green
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
Write-Host "  Authentication: Service Account" -ForegroundColor White
Write-Host ""

# Verify config file exists
if (-not (Test-Path ".agent_engine_config.json")) {
    Write-Host "ERROR: Config file not found: .agent_engine_config.json" -ForegroundColor Red
    exit 1
}

# Deploy using ADK
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

