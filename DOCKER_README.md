# Docker Deployment Guide for OIC Agent Ops

This guide explains how to build and run the MCP servers and agents using Docker.

## Overview

The project consists of:
- **MCP Server**: OIC Monitor MCP Server (Node.js/TypeScript)
- **Agents**: 5 Python agents that interact with the MCP server

## Prerequisites

1. **Docker Desktop** installed and running
2. **.env files** configured in each agent directory (copied from Day1a)
3. **Service account JSON** file (if using Vertex AI)

## Project Structure

```
OICAgentOps/
├── docker-compose.yml          # Main compose file
├── Agents/
│   ├── Dockerfile              # Unified Dockerfile for all agents
│   ├── CoordinatorAgent/
│   │   ├── .env                # Environment variables
│   │   ├── agent.py
│   │   └── requirements.txt
│   ├── MonitorErrorsAgent/
│   ├── MonitorQueueRequestAgent/
│   ├── RecoveryJobAgent/
│   └── ResubmitErrorsAgent/
└── MCPServers/
    ├── Dockerfile              # Dockerfile for MCP server
    └── oic-monitor-server/
        ├── package.json
        ├── src/
        └── tsconfig.json
```

## Quick Start

### 1. Build and Start All Services

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

This will:
- Build the MCP server image
- Build the agents image
- Start all 6 containers (1 MCP server + 5 agents)

### 2. Build Individual Images

#### Build MCP Server Image Only

```bash
docker build -t oic-mcp-server -f MCPServers/Dockerfile MCPServers/
```

#### Build Agents Image Only

```bash
docker build -t oic-agents -f Agents/Dockerfile .
```

### 3. Run Individual Services

```bash
# Start only MCP server
docker-compose up mcp-server

# Start only a specific agent
docker-compose up coordinator-agent

# Start MCP server and one agent
docker-compose up mcp-server coordinator-agent
```

## Services

### MCP Server
- **Container**: `oic-mcp-server`
- **Image**: `oic-mcp-server:latest`
- **Port**: 3000 (changed from 8080 to avoid conflict with kaggle-5-day-agents)
- **Health Check**: http://localhost:3000/health
- **Build Context**: `MCPServers/`

### Agents
All agents share the same base image (`oic-agents:latest`) but run as separate containers:

1. **CoordinatorAgent** (`oic-coordinator-agent`)
2. **MonitorErrorsAgent** (`oic-monitor-errors-agent`)
3. **MonitorQueueRequestAgent** (`oic-monitor-queue-agent`)
4. **RecoveryJobAgent** (`oic-recovery-job-agent`)
5. **ResubmitErrorsAgent** (`oic-resubmit-errors-agent`)

## Environment Variables

### MCP Server
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (default: production)

### Agents
All agents use these environment variables:
- `GOOGLE_CLOUD_PROJECT`: GCP project ID
- `GOOGLE_CLOUD_LOCATION`: GCP location (default: us-central1)
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON
- `MCP_SERVER_URL`: URL to MCP server (default: http://mcp-server:3000)
- `AGENT_MODEL`: Gemini model (default: gemini-2.5-flash-lite)
- `ADK_LOG_LEVEL`: Logging level (default: DEBUG)

These are loaded from `.env` files in each agent directory.

## Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f mcp-server
docker-compose logs -f coordinator-agent
```

### Stop Services
```bash
docker-compose down
```

### Rebuild After Code Changes
```bash
docker-compose up --build
```

### Access Container Shell
```bash
# MCP server
docker exec -it oic-mcp-server /bin/bash

# Agent
docker exec -it oic-coordinator-agent /bin/bash
```

### Check Running Containers
```bash
docker ps
# Or
docker-compose ps
```

## Troubleshooting

### Port 3000 Already in Use
Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead
```

**Note**: Port 3000 is used to avoid conflict with kaggle-5-day-agents which uses port 8080.

### MCP Server Not Starting
1. Check logs: `docker-compose logs mcp-server`
2. Verify TypeScript build: Check for compilation errors
3. Verify health endpoint: `curl http://localhost:3000/health`

### Agents Can't Connect to MCP Server
1. Ensure MCP server is running: `docker-compose ps`
2. Check `MCP_SERVER_URL` environment variable
3. Verify network connectivity: `docker network ls`

### Environment Variables Not Loading
1. Check that `.env` files exist in each agent directory
2. Verify volume mounts in `docker-compose.yml`
3. Check container logs for environment variable errors

### Service Account Authentication
1. Ensure `service_account.json` exists in project root
2. Verify `GOOGLE_APPLICATION_CREDENTIALS` path in `.env` files
3. Check volume mount in `docker-compose.yml`

## Development

### Running Individual Agents Locally

You can still run agents locally for development:

```bash
cd Agents/CoordinatorAgent
python agent.py
```

### Testing MCP Server Locally

```bash
cd MCPServers/oic-monitor-server
npm install
npm run build
npm start
```

## Notes

- All agents share the same Docker image but run as separate containers
- The MCP server must be running before agents can connect
- `.env` files are mounted as read-only volumes
- Service account JSON is mounted for authentication
- Health checks are configured for the MCP server

