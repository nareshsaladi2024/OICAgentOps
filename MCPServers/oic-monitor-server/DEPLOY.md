# Deployment Guide - OIC Monitor MCP Server

This guide covers deploying the OIC Monitor MCP Server to Docker Desktop and Google Cloud Run.

## Prerequisites

1. **.env file configured** with OIC credentials for all environments
   ```powershell
   .\setup-env.ps1
   ```
   Or verify existing:
   ```powershell
   .\verify-env.ps1
   ```

2. **Docker Desktop** (for local deployment)
   - Install from: https://www.docker.com/products/docker-desktop
   - Ensure Docker is running

3. **Google Cloud SDK** (for Cloud Run deployment)
   - Install from: https://cloud.google.com/sdk/docs/install
   - Authenticate: `gcloud auth login`

## Deploy to Docker Desktop

### Quick Deploy
```powershell
.\deploy-to-docker-desktop.ps1
```

This will:
- Build the Docker image
- Start the container
- Expose service on port 3000 (or PORT from .env)

### Options

**Build only:**
```powershell
.\deploy-to-docker-desktop.ps1 -BuildOnly
```

**Start only (skip build):**
```powershell
.\deploy-to-docker-desktop.ps1 -StartOnly
```

**Stop container:**
```powershell
.\deploy-to-docker-desktop.ps1 -Stop
```

**Remove container and image:**
```powershell
.\deploy-to-docker-desktop.ps1 -Remove
```

### Access Services

After deployment:
- **MCP Server**: http://localhost:3000
- **SSE Endpoint**: http://localhost:3000/sse
- **Health Check**: http://localhost:3000/health

### View Logs
```powershell
docker compose logs -f
```

## Deploy to Cloud Run

### Quick Deploy
```powershell
.\deploy-to-cloud-run.ps1
```

### Custom Configuration
```powershell
.\deploy-to-cloud-run.ps1 -ProjectId "my-project" -Region "us-west1"
```

### Build Only (for testing)
```powershell
.\deploy-to-cloud-run.ps1 -BuildOnly
```

### What It Does

1. **Loads .env file** - Reads all OIC credentials
2. **Builds Docker image** - Uses Cloud Build
3. **Deploys to Cloud Run** - Sets all environment variables
4. **Returns service URL** - For MCP client configuration

### Environment Variables

The script automatically loads **all** variables from `.env` file, including:
- `OIC_CLIENT_ID_DEV`, `OIC_CLIENT_ID_QA3`, `OIC_CLIENT_ID_PROD1`, `OIC_CLIENT_ID_PROD3`
- `OIC_CLIENT_SECRET_DEV`, `OIC_CLIENT_SECRET_QA3`, `OIC_CLIENT_SECRET_PROD1`, `OIC_CLIENT_SECRET_PROD3`
- `OIC_TOKEN_URL_DEV`, `OIC_TOKEN_URL_QA3`, `OIC_TOKEN_URL_PROD1`, `OIC_TOKEN_URL_PROD3`
- And all other OIC_* variables

### After Deployment

The script will output:
```
Service URL: https://oic-monitor-server-xxx.run.app
SSE Endpoint: https://oic-monitor-server-xxx.run.app/sse
Health Check: https://oic-monitor-server-xxx.run.app/health
```

**Update your MCP client configuration:**
```
MCP_SERVER_URL=https://oic-monitor-server-xxx.run.app/sse
```

## Environment Variables Setup

### Required Variables Format

The server expects environment-specific variables in `.env`:

```env
# Development
OIC_CLIENT_ID_DEV=your-dev-client-id
OIC_CLIENT_SECRET_DEV=your-dev-client-secret
OIC_TOKEN_URL_DEV=https://dev-instance.../oauth2/token
OIC_API_BASE_URL_DEV=https://dev-instance.../ic/api/integration/v1

# Production 1
OIC_CLIENT_ID_PROD1=your-prod1-client-id
OIC_CLIENT_SECRET_PROD1=your-prod1-client-secret
OIC_TOKEN_URL_PROD1=https://prod1-instance.../oauth2/token
OIC_API_BASE_URL_PROD1=https://prod1-instance.../ic/api/integration/v1

# Production 3
OIC_CLIENT_ID_PROD3=your-prod3-client-id
OIC_CLIENT_SECRET_PROD3=your-prod3-client-secret
OIC_TOKEN_URL_PROD3=https://prod3-instance.../oauth2/token
OIC_API_BASE_URL_PROD3=https://prod3-instance.../ic/api/integration/v1
```

### Setup Scripts

**Interactive setup:**
```powershell
.\setup-env.ps1
```

**Setup specific environment:**
```powershell
.\setup-env.ps1 -Environment prod1
```

**Verify configuration:**
```powershell
.\verify-env.ps1
```

## Troubleshooting

### Docker Desktop

**Container won't start:**
- Check Docker Desktop is running
- Check port 3000 is not in use
- View logs: `docker compose logs`

**Environment variables not loading:**
- Verify `.env` file exists in project root
- Check `.env` file has correct format (no spaces around `=`)
- Restart container: `.\deploy-to-docker-desktop.ps1 -Stop` then `.\deploy-to-docker-desktop.ps1`

### Cloud Run

**Build fails:**
- Check Dockerfile syntax
- Verify TypeScript compiles: `npm run build`
- Check Cloud Build logs in GCP Console

**Deployment fails:**
- Verify gcloud authentication: `gcloud auth login`
- Check project permissions
- Verify APIs are enabled

**Environment variables not set:**
- Check `.env` file exists and has values
- Verify variables are loaded: Check Cloud Run service environment variables in console
- Redeploy after updating `.env`

**Authentication errors:**
- Verify OIC credentials are correct in `.env`
- Check environment-specific variables (e.g., `OIC_CLIENT_ID_PROD1`)
- Ensure token URLs are correct

## Service URLs

### Docker Desktop
- Base: http://localhost:3000
- SSE: http://localhost:3000/sse
- Health: http://localhost:3000/health

### Cloud Run
- Base: https://oic-monitor-server-xxx.run.app
- SSE: https://oic-monitor-server-xxx.run.app/sse
- Health: https://oic-monitor-server-xxx.run.app/health

## Next Steps

1. **Test locally** with Docker Desktop
2. **Deploy to Cloud Run** for production
3. **Configure MCP clients** to use the service URL
4. **Monitor logs** for any issues

## Files

- `deploy-to-docker-desktop.ps1` - Docker Desktop deployment
- `deploy-to-cloud-run.ps1` - Cloud Run deployment
- `setup-env.ps1` - Interactive environment setup
- `verify-env.ps1` - Verify .env configuration
- `Dockerfile` - Docker image definition
- `docker-compose.yml` - Docker Compose configuration



