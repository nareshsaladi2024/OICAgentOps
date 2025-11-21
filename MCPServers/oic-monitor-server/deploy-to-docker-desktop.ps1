<#
.SYNOPSIS
    Deploys OIC Monitor MCP Server to Windows Docker Desktop

.DESCRIPTION
    This script builds and deploys the OIC Monitor MCP Server Docker image to Windows Docker Desktop.
    It checks prerequisites, builds images, and starts containers using docker-compose.

.PARAMETER BuildOnly
    Only build the images without starting containers

.PARAMETER StartOnly
    Only start containers without rebuilding images

.PARAMETER Stop
    Stop all running containers

.PARAMETER Remove
    Stop and remove all containers and images

.EXAMPLE
    .\deploy-to-docker-desktop.ps1
    Builds and starts the service

.EXAMPLE
    .\deploy-to-docker-desktop.ps1 -BuildOnly
    Only builds the image

.EXAMPLE
    .\deploy-to-docker-desktop.ps1 -Stop
    Stops all running containers

.EXAMPLE
    .\deploy-to-docker-desktop.ps1 -Remove
    Stops and removes all containers and images
#>

param(
    [switch]$BuildOnly,
    [switch]$StartOnly,
    [switch]$Stop,
    [switch]$Remove
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OIC Monitor MCP Server Docker Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        $dockerVersion = docker version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Docker is not running or not installed." -ForegroundColor Red
            Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
            return $false
        }
        Write-Host "Docker is running" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "ERROR: Docker is not running or not installed." -ForegroundColor Red
        Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
        return $false
    }
}

# Function to check if docker-compose is available
function Test-DockerCompose {
    try {
        $composeVersion = docker compose version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: docker-compose is not available." -ForegroundColor Red
            return $false
        }
        Write-Host "Docker Compose is available" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "ERROR: docker-compose is not available." -ForegroundColor Red
        return $false
    }
}

# Function to check required environment variables
function Test-EnvironmentVariables {
    $missing = @()
    
    $requiredVars = @("OIC_CLIENT_ID", "OIC_CLIENT_SECRET", "OIC_TOKEN_URL", "OIC_API_BASE_URL", "OIC_INTEGRATION_INSTANCE")
    
    foreach ($var in $requiredVars) {
        $value = [Environment]::GetEnvironmentVariable($var, "Process")
        if (-not $value) {
            $missing += $var
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "WARNING: Missing environment variables:" -ForegroundColor Yellow
        foreach ($var in $missing) {
            Write-Host "  - $var" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "You can set them using:" -ForegroundColor Yellow
        Write-Host "  1. Helper script: .\set-docker-env-vars.ps1" -ForegroundColor Gray
        Write-Host "  2. PowerShell: `$env:OIC_CLIENT_ID = 'your-value'" -ForegroundColor Gray
        Write-Host "  3. Create .env file: Copy .env.example to .env and fill in values" -ForegroundColor Gray
        Write-Host ""
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            return $false
        }
    }
    
    return $true
}

# Handle Stop option
if ($Stop) {
    Write-Host "Stopping OIC Monitor MCP Server container..." -ForegroundColor Yellow
    docker compose down
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Container stopped" -ForegroundColor Green
    }
    exit 0
}

# Handle Remove option
if ($Remove) {
    Write-Host "Removing OIC Monitor MCP Server container and image..." -ForegroundColor Yellow
    $response = Read-Host "This will remove the container and image. Continue? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        docker compose down -v --rmi all
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Container and image removed" -ForegroundColor Green
        }
    }
    exit 0
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Cyan
if (-not (Test-DockerRunning)) {
    exit 1
}
if (-not (Test-DockerCompose)) {
    exit 1
}

Write-Host ""

# Check for .env file
$envFile = Join-Path $ScriptDir ".env"
if (Test-Path $envFile) {
    Write-Host "Found .env file - environment variables will be loaded from it" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "No .env file found. You can create one using:" -ForegroundColor Yellow
    Write-Host "  .\set-docker-env-vars.ps1" -ForegroundColor Gray
    Write-Host ""
}

# Check environment variables
if (-not (Test-EnvironmentVariables)) {
    exit 1
}

Write-Host ""

# Build images
if (-not $StartOnly) {
    Write-Host "Building Docker image..." -ForegroundColor Cyan
    Write-Host ""
    
    docker compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to build image" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Image built successfully" -ForegroundColor Green
    Write-Host ""
}

# Start containers
if (-not $BuildOnly) {
    Write-Host "Starting container..." -ForegroundColor Cyan
    Write-Host ""
    
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to start container" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Container started successfully" -ForegroundColor Green
    Write-Host ""
    
    # Wait a moment for container to start
    Start-Sleep -Seconds 3
    
    # Show container status
    Write-Host "Container Status:" -ForegroundColor Cyan
    Write-Host ""
    docker compose ps
    Write-Host ""
    
    # Show service URLs
    $port = [Environment]::GetEnvironmentVariable("PORT", "Process")
    if (-not $port) { $port = "3000" }
    
    Write-Host "Service URLs:" -ForegroundColor Cyan
    Write-Host "  - OIC Monitor MCP Server: http://localhost:$port" -ForegroundColor Green
    Write-Host "  - SSE Endpoint: http://localhost:$port/sse" -ForegroundColor Green
    Write-Host "  - Health Check: http://localhost:$port/health" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "To view logs:" -ForegroundColor Cyan
    Write-Host "  docker compose logs -f" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To stop container:" -ForegroundColor Cyan
    Write-Host "  .\deploy-to-docker-desktop.ps1 -Stop" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

