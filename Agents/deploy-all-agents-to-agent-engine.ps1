<#
.SYNOPSIS
    Deploy all OIC agents to Vertex AI Agent Engine with MCP Server URL

.DESCRIPTION
    Deploys all agents from the Agents/ directory to Vertex AI Agent Engine.
    Sets the MCP_SERVER_URL environment variable to the provided Cloud Run URL.

.PARAMETER ProjectId
    Google Cloud Project ID (default: from .env or aiagent-capstoneproject)

.PARAMETER Region
    Agent Engine region (default: us-central1)

.PARAMETER McpServerUrl
    MCP Server URL (default: https://oic-monitor-server-1276251306.us-central1.run.app/)

.PARAMETER Agent
    Specific agent to deploy (optional, deploys all if not specified)

.EXAMPLE
    .\deploy-all-agents-to-agent-engine.ps1

.EXAMPLE
    .\deploy-all-agents-to-agent-engine.ps1 -McpServerUrl "https://your-mcp-server.run.app/"

.EXAMPLE
    .\deploy-all-agents-to-agent-engine.ps1 -Agent "CoordinatorAgent"
#>

param(
    [string]$ProjectId = "",
    [string]$Region = "us-east4",
    [string]$McpServerUrl = "https://oic-monitor-server-1276251306.us-central1.run.app/",
    [string]$Agent = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy OIC Agents to Vertex AI Engine" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load .env file if exists
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Get project ID
if ([string]::IsNullOrEmpty($ProjectId)) {
    $ProjectId = $env:GOOGLE_CLOUD_PROJECT
    if ([string]::IsNullOrEmpty($ProjectId)) {
        $ProjectId = "aiagent-capstoneproject"
    }
}

# Ensure MCP_SERVER_URL ends with /
if (-not $McpServerUrl.EndsWith("/")) {
    $McpServerUrl = $McpServerUrl + "/"
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command adk -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] ADK CLI not found. Install with: pip install google-adk" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] gcloud CLI not found" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Prerequisites met" -ForegroundColor Green
Write-Host ""

# Configure Authentication - Enforce Application Default Credentials (ADC)
Write-Host "Configuring authentication..." -ForegroundColor Cyan

# Unset GOOGLE_APPLICATION_CREDENTIALS to enforce use of ADC
if ($env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "[INFO] Unsetting GOOGLE_APPLICATION_CREDENTIALS to enforce ADC" -ForegroundColor Yellow
    Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS
}

# Check if user is authenticated with gcloud
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if ($LASTEXITCODE -ne 0 -or -not $authCheck) {
    Write-Host "[WARNING] No active gcloud authentication found!" -ForegroundColor Yellow
    Write-Host "Please run: gcloud auth application-default login" -ForegroundColor Cyan
    exit 1
}

Write-Host "[OK] Authenticated as: $authCheck" -ForegroundColor Green

# Set the quota project for ADC
Write-Host "Setting ADC quota project..." -ForegroundColor Cyan
try {
    gcloud auth application-default set-quota-project $ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Quota project set to: $ProjectId" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Could not set quota project (non-critical)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not set quota project (non-critical)" -ForegroundColor Yellow
}
Write-Host ""

# Set project
gcloud config set project $ProjectId

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Project: $ProjectId" -ForegroundColor White
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  MCP Server URL: $McpServerUrl" -ForegroundColor White
Write-Host ""

# Find all agent directories
$agentDirs = @()
if ($Agent) {
    $agentPath = Join-Path $ScriptDir $Agent
    if (Test-Path $agentPath -PathType Container) {
        $agentDirs = @($agentPath)
    } else {
        Write-Host "[ERROR] Agent directory not found: $Agent" -ForegroundColor Red
        exit 1
    }
} else {
    # Find all directories with agent.py and deploy-with-adc.ps1
    Get-ChildItem -Directory | ForEach-Object {
        $agentDir = $_.FullName
        $agentPy = Join-Path $agentDir "agent.py"
        $deployScript = Join-Path $agentDir "deploy-with-adc.ps1"
        if ((Test-Path $agentPy) -and (Test-Path $deployScript)) {
            $agentDirs += $agentDir
        }
    }
}

if ($agentDirs.Count -eq 0) {
    Write-Host "[ERROR] No agents found to deploy" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($agentDirs.Count) agent(s) to deploy:" -ForegroundColor Cyan
foreach ($dir in $agentDirs) {
    Write-Host "  - $(Split-Path -Leaf $dir)" -ForegroundColor White
}
Write-Host ""

# Deploy each agent
$deployed = 0
$failed = 0

foreach ($agentDir in $agentDirs) {
    $agentName = Split-Path -Leaf $agentDir
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Deploying: $agentName" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check for config file (using full path)
    $configFile = Join-Path $agentDir ".agent_engine_config.json"
    if (-not (Test-Path $configFile)) {
        Write-Host "[WARNING] Config file not found: .agent_engine_config.json" -ForegroundColor Yellow
        Write-Host "  Creating default config..." -ForegroundColor Yellow
        
        # Create default config
        $defaultConfig = @{
            deployment_spec = @{
                env = @{
                    MCP_SERVER_URL = $McpServerUrl
                    GOOGLE_CLOUD_PROJECT = $ProjectId
                    GOOGLE_CLOUD_LOCATION = $Region
                }
            }
        } | ConvertTo-Json -Depth 10
        
        Set-Content -Path $configFile -Value $defaultConfig
        Write-Host "[OK] Created default config" -ForegroundColor Green
    } else {
        # Update existing config with MCP_SERVER_URL
        Write-Host "Updating config with MCP_SERVER_URL..." -ForegroundColor Cyan
        $config = Get-Content $configFile | ConvertFrom-Json
        
        if (-not $config.deployment_spec) {
            $config | Add-Member -MemberType NoteProperty -Name "deployment_spec" -Value @{}
        }
        if (-not $config.deployment_spec.env) {
            $config.deployment_spec | Add-Member -MemberType NoteProperty -Name "env" -Value @{}
        }
        
        $config.deployment_spec.env.MCP_SERVER_URL = $McpServerUrl
        $config.deployment_spec.env.GOOGLE_CLOUD_PROJECT = $ProjectId
        $config.deployment_spec.env.GOOGLE_CLOUD_LOCATION = $Region
        
        # Remove GOOGLE_APPLICATION_CREDENTIALS if present (reserved variable)
        if ($config.deployment_spec.env.PSObject.Properties.Name -contains "GOOGLE_APPLICATION_CREDENTIALS") {
            $config.deployment_spec.env.PSObject.Properties.Remove("GOOGLE_APPLICATION_CREDENTIALS")
        }
        
        $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile
        Write-Host "[OK] Updated config" -ForegroundColor Green
    }
    
    Write-Host ""
    
    # Set MCP_SERVER_URL in environment for this deployment
    $env:MCP_SERVER_URL = $McpServerUrl
    
    # Deploy using ADK
    # ADK requires deployment from the Agents/ directory, not from individual agent directories
    # Use relative paths from Agents/ directory
    Write-Host "Deploying $agentName to Vertex AI Agent Engine..." -ForegroundColor Cyan
    Write-Host "  MCP Server: $McpServerUrl" -ForegroundColor Gray
    Write-Host "  Region: $Region" -ForegroundColor Gray
    Write-Host ""
    
    # Ensure we're in the Agents/ directory (project root for ADK)
    Set-Location $ScriptDir
    
    # Use relative path from Agents/ directory
    $relativeAgentPath = $agentName
    $relativeConfigPath = Join-Path $agentName ".agent_engine_config.json"
    
    Write-Host "  Running from: $ScriptDir" -ForegroundColor Gray
    Write-Host "  Agent path: $relativeAgentPath" -ForegroundColor Gray
    Write-Host "  Config path: $relativeConfigPath" -ForegroundColor Gray
    Write-Host ""
    
    # Deploy using relative paths
    adk deploy agent_engine --project=$ProjectId --region=$Region $relativeAgentPath --agent_engine_config_file=$relativeConfigPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] $agentName deployed successfully!" -ForegroundColor Green
        $deployed++
    } else {
        Write-Host ""
        Write-Host "[ERROR] $agentName deployment failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        $failed++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployed: $deployed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($deployed -gt 0) {
    Write-Host "View agents in console:" -ForegroundColor Cyan
    Write-Host "  https://console.cloud.google.com/vertex-ai/agents/agent-engines?project=$ProjectId" -ForegroundColor White
    Write-Host ""
    Write-Host "MCP Server URL configured: $McpServerUrl" -ForegroundColor Green
    Write-Host ""
}

if ($failed -gt 0) {
    exit 1
}

