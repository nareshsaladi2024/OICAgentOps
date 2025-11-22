# PowerShell script to run the MonitorQueueRequestAgent

# Navigate to script directory
Set-Location $PSScriptRoot

Write-Host "MonitorQueueRequestAgent" -ForegroundColor Green
Write-Host ("=" * 50) -ForegroundColor Gray
Write-Host ""

# Check for required environment variables
if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and -not $env:GOOGLE_CLOUD_PROJECT) {
    Write-Host "WARNING: Google Cloud credentials not configured!" -ForegroundColor Yellow
    Write-Host "   Set one of the following:" -ForegroundColor Yellow
    Write-Host "   - `$env:GOOGLE_APPLICATION_CREDENTIALS = 'path\to\credentials.json'" -ForegroundColor Cyan
    Write-Host "   - `$env:GOOGLE_CLOUD_PROJECT = 'your-project-id'" -ForegroundColor Cyan
    Write-Host "   - Run: gcloud auth application-default login" -ForegroundColor Cyan
    Write-Host ""
}

# Check for MCP server URL
if (-not $env:MCP_SERVER_URL) {
    Write-Host "Using default OIC Monitor MCP server URL: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   Set `$env:MCP_SERVER_URL to use a different URL" -ForegroundColor Gray
    Write-Host ""
}

# Find Python executable
$python = $null

# Try to get real Python executable
$wherePython = where.exe python 2>$null | Where-Object { $_ -match "\.exe$" } | Select-Object -First 1
if ($wherePython -and (Test-Path $wherePython)) {
    $python = $wherePython
} elseif (Test-Path "c:\ProgramData\anaconda3\python.exe") {
    $python = "c:\ProgramData\anaconda3\python.exe"
} elseif (Test-Path "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe") {
    $python = (Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe" | Select-Object -First 1).FullName
} else {
    $python = "python"
}

Write-Host "Python: $python" -ForegroundColor Cyan
Write-Host ""

# Run the test script
Write-Host "Running agent test suite..." -ForegroundColor Cyan
Write-Host ""

& $python test-agent.py

