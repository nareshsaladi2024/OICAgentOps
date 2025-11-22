# MonitorQueueRequestAgent

AI Agent built with Google ADK that monitors integration instances in the queue by retrieving IN_PROGRESS instances from Oracle Integration Cloud via the OIC Monitor MCP server.

## Overview

MonitorQueueRequestAgent specializes in monitoring integration instances that are currently being processed. It uses the OIC Monitor MCP server to access:
- IN_PROGRESS integration instances from the past hour
- Instance details including status, tracking variables, and execution information
- Real-time queue status and monitoring

## Features

- **Queue Monitoring**: Retrieves IN_PROGRESS instances from the integration queue
- **Structured Reports**: Provides formatted, structured text reports
- **Real-time Status**: Monitors current queue status with detailed instance information
- **Health Checking**: Verifies MCP server connectivity and health

## Prerequisites

1. **OIC Monitor MCP Server**: The agent requires the OIC Monitor MCP server to be running. See `../../MCPServers/oic-monitor-server/` for server setup.

2. **Google Cloud Credentials**: Configure one of the following:
   - Service account key file
   - Application Default Credentials
   - Google Cloud project credentials

## Setup

### 1. Install Dependencies

```powershell
cd Agents\MonitorQueueRequestAgent
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file or set environment variables:

```powershell
# Google Cloud Configuration (choose one)
$env:GOOGLE_APPLICATION_CREDENTIALS = "path\to\your-service-account-key.json"
# OR
$env:GOOGLE_CLOUD_PROJECT = "your-project-id"
$env:GOOGLE_CLOUD_LOCATION = "us-central1"

# OIC Monitor MCP Server URL (optional, defaults to http://localhost:3000)
$env:MCP_SERVER_URL = "http://localhost:3000"

# Agent Model (optional, defaults to gemini-2.5-flash-lite)
$env:AGENT_MODEL = "gemini-2.5-flash-lite"
```

Or use `.env` file:
```env
GOOGLE_APPLICATION_CREDENTIALS=path/to/your-service-account-key.json
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
MCP_SERVER_URL=http://localhost:3000
AGENT_MODEL=gemini-2.5-flash-lite
```

### 3. Start the OIC Monitor MCP Server

**Important**: The OIC Monitor MCP server must be running before using the agent.

In one terminal:
```powershell
cd ../../MCPServers/oic-monitor-server
node dist/src/index.js
```

### 4. Run the Agent

```powershell
cd Agents\MonitorQueueRequestAgent
.\run-agent.ps1
```

Or test the agent:
```powershell
python test-agent.py
```

## Usage

### Programmatic Usage

```python
from agent import root_agent

# Get queue status
response = root_agent.run("What integration instances are currently IN_PROGRESS in the queue?")
print(response)

# Get specific instance details
response = root_agent.run("Show me all IN_PROGRESS instances from the past hour")
print(response)
```

### Example Queries

- "What integration instances are currently IN_PROGRESS in the queue?"
- "Show me all IN_PROGRESS instances from the past hour"
- "Get the queue status for app-driven integrations"
- "How many instances are currently being processed?"

## Agent Tools

The agent has access to two tools:

1. **`call_mcp_monitoring_instances(...)`**: 
   - Retrieves IN_PROGRESS instances from OIC Monitor MCP server
   - Default query: `{timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}`
   - Returns: Structured text report with instance details

2. **`check_mcp_server_health()`**: 
   - Checks if the OIC Monitor MCP server is running and healthy
   - Returns: Server status and connection information

## Deployment

### Deploy to Vertex AI (Using ADC)

```powershell
.\deploy-with-adc.ps1
```

### Deploy to Vertex AI (Using Service Account)

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "path\to\service-account-key.json"
.\deploy-with-service-account.ps1
```

### Deploy to Local Docker

```powershell
# Build the Docker image
docker build -t monitor-queue-request-agent .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -d \
  -e GOOGLE_CLOUD_PROJECT=your-project-id \
  -e MCP_SERVER_URL=http://host.docker.internal:3000 \
  -p 8000:8000 \
  monitor-queue-request-agent
```

## Response Format

The agent returns structured text with:
- **Summary**: Total records, time window, pagination info
- **Instance Details**: For each instance:
  - Instance ID and Run ID
  - Integration name, ID, and version
  - Status and execution dates
  - Tracking variables (primary, secondary, tertiary)
  - Duration and performance metrics
  - Project information

## Architecture

```
User Query
    ↓
MonitorQueueRequestAgent (Google ADK)
    ↓
OIC Monitor MCP Server (HTTP REST API)
    ↓
Oracle Integration Cloud API
    ↓
Integration Instances Response
```

## Troubleshooting

### OIC Monitor MCP Server Not Found

If you see "Cannot connect to OIC Monitor MCP server":
1. Make sure the OIC Monitor MCP server is running (`node dist/src/index.js` in `../../MCPServers/oic-monitor-server/`)
2. Check the `MCP_SERVER_URL` environment variable
3. Verify the server is accessible: `Invoke-WebRequest http://localhost:3000/health`

### Google Cloud Credentials Error

If you see credential errors:
1. Set `GOOGLE_APPLICATION_CREDENTIALS` to a valid service account key
2. OR run: `gcloud auth application-default login`
3. OR set `GOOGLE_CLOUD_PROJECT` and ensure you're authenticated

### No Instances Found

If no instances are returned:
1. Check that there are actually IN_PROGRESS instances in OIC
2. Verify the time window (default is 1 hour)
3. Check the integration-style filter (default is 'appdriven')

## Files

- `agent.py`: Main agent implementation with Google ADK
- `test-agent.py`: Test script for the agent
- `run-agent.ps1`: PowerShell script to run the agent
- `deploy-with-adc.ps1`: Deploy to Vertex AI using ADC
- `deploy-with-service-account.ps1`: Deploy to Vertex AI using service account
- `Dockerfile`: Docker image definition
- `docker-compose.yml`: Docker Compose configuration
- `.agent_engine_config.json`: Vertex AI Agent Engine configuration
- `requirements.txt`: Python dependencies

## Related

- OIC Monitor MCP Server: `../../MCPServers/oic-monitor-server/`
- Google ADK Documentation: https://github.com/google/generative-ai-python

## License

MIT

