# Deploying OIC Monitor MCP Server to Docker Desktop

This guide explains how to deploy the OIC Monitor MCP Server to Windows Docker Desktop for local development and testing.

## Prerequisites

1. **Docker Desktop** installed and running
2. **Docker Compose** (included with Docker Desktop)

## Quick Start

### 1. Set Environment Variables

Create a `.env` file or set environment variables:

```powershell
# Using helper script
cd MCPServers\oic-monitor-server
.\set-docker-env-vars.ps1 -UseEnvFile -OicClientId "your-id" -OicClientSecret "your-secret" -OicTokenUrl "..." -OicApiBaseUrl "..." -OicIntegrationInstance "..."
```

Or manually create `.env` file:

```env
OIC_CLIENT_ID=your-client-id
OIC_CLIENT_SECRET=your-client-secret
OIC_TOKEN_URL=https://your-instance.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_API_BASE_URL=https://your-instance.integration.ocp.oc-test.com/ic/api/integration/v1/monitoring
OIC_INTEGRATION_INSTANCE=your-instance-name
OIC_SCOPE=urn:opc:idm:__myscopes__
PORT=3000
```

### 2. Deploy to Docker Desktop

```powershell
cd MCPServers\oic-monitor-server
.\deploy-to-docker-desktop.ps1
```

## Manual Deployment

### Build and Start

```powershell
cd MCPServers\oic-monitor-server

# Build the image
docker compose build

# Start the container
docker compose up -d

# View logs
docker compose logs -f
```

### Stop Container

```powershell
.\deploy-to-docker-desktop.ps1 -Stop
```

Or manually:

```powershell
docker compose down
```

### Remove Container and Image

```powershell
.\deploy-to-docker-desktop.ps1 -Remove
```

Or manually:

```powershell
docker compose down -v --rmi all
```

## Service URLs

After starting the container:

- **Server**: http://localhost:3000
- **SSE Endpoint**: http://localhost:3000/sse
- **Health Check**: http://localhost:3000/health

## Environment Variables

### Required Variables

- `OIC_CLIENT_ID` - OIC OAuth2 Client ID
- `OIC_CLIENT_SECRET` - OIC OAuth2 Client Secret
- `OIC_TOKEN_URL` - OIC OAuth2 Token URL
- `OIC_API_BASE_URL` - OIC Monitoring API Base URL
- `OIC_INTEGRATION_INSTANCE` - OIC Integration Instance name

### Optional Variables

- `OIC_SCOPE` - OAuth2 scope (default: `urn:opc:idm:__myscopes__`)
- `PORT` - Server port (default: 3000)

## Using the Server

### Test Health Endpoint

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

### Test Root Endpoint

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/"
```

### Connect MCP Client

Update your MCP client configuration:

```python
MCP_SERVER_URL = "http://localhost:3000/sse"
```

## Troubleshooting

### Container Not Starting

Check logs:

```powershell
docker compose logs
```

### Environment Variables Not Set

Verify `.env` file exists and contains all required variables:

```powershell
Get-Content .env
```

### Port Already in Use

Change the port in `.env`:

```env
PORT=3001
```

Then restart:

```powershell
docker compose down
docker compose up -d
```

### Build Errors

If you see build errors, ensure:

1. Docker Desktop is running
2. You have sufficient disk space
3. TypeScript is compiled: `npx tsc`

### 401 Authentication Errors

If you see 401 errors:

1. Verify OIC credentials are correct
2. Check that token URL is accessible
3. Ensure OIC integration instance name is correct
4. Check logs: `docker compose logs`

### Container Keeps Restarting

Check logs for errors:

```powershell
docker compose logs --tail=50
```

Common causes:
- Missing environment variables
- Invalid OIC credentials
- Network connectivity issues

## Development Mode

For development with hot-reload, you can mount the source directory:

```yaml
# In docker-compose.yml, volumes section already includes:
volumes:
  - ./dist:/app/dist
  - ./src:/app/src
```

After making changes:

1. Rebuild TypeScript: `npx tsc`
2. Restart container: `docker compose restart`

## Production Considerations

For production deployments:

1. Remove volume mounts for source code
2. Use production build (already configured)
3. Set appropriate resource limits
4. Use secrets management for credentials
5. Enable health checks (already configured)
6. Set up monitoring and logging

