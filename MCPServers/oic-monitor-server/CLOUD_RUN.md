# Deploying OIC Monitor MCP Server to Google Cloud Run

This guide explains how to deploy the OIC Monitor MCP Server to Google Cloud Run for production use.

## Prerequisites

1. **Google Cloud SDK (gcloud CLI)** installed and configured
2. **Docker** installed and running
3. **Google Cloud Project** with billing enabled
4. **Required APIs enabled**:
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API

## Quick Start

### 1. Set Environment Variables

```powershell
# Required OIC credentials
$env:OIC_CLIENT_ID = "your-client-id"
$env:OIC_CLIENT_SECRET = "your-client-secret"
$env:OIC_TOKEN_URL = "https://your-instance.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token"
$env:OIC_API_BASE_URL = "https://your-instance.integration.ocp.oc-test.com/ic/api/integration/v1/monitoring"
$env:OIC_INTEGRATION_INSTANCE = "your-instance-name"
$env:OIC_SCOPE = "urn:opc:idm:__myscopes__"  # Optional
```

### 2. Deploy to Cloud Run

```powershell
cd MCPServers\oic-monitor-server
.\deploy-to-cloud-run.ps1
```

### 3. Set Environment Variables in Cloud Run

After deployment, set the environment variables:

```powershell
.\set-cloud-run-env-vars.ps1 -OicClientId "your-id" -OicClientSecret "your-secret" -OicTokenUrl "..." -OicApiBaseUrl "..." -OicIntegrationInstance "..."
```

Or use local environment variables:

```powershell
$env:OIC_CLIENT_ID = "your-id"
$env:OIC_CLIENT_SECRET = "your-secret"
# ... set other vars
.\set-cloud-run-env-vars.ps1
```

## Manual Deployment Steps

### Build and Deploy

```powershell
cd MCPServers\oic-monitor-server

# Build the image
gcloud builds submit --tag gcr.io/aiagent-capstoneproject/oic-monitor-server:latest

# Deploy to Cloud Run
gcloud run deploy oic-monitor-server `
  --image gcr.io/aiagent-capstoneproject/oic-monitor-server:latest `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars OIC_CLIENT_ID=your-id,OIC_CLIENT_SECRET=your-secret,OIC_TOKEN_URL=...,OIC_API_BASE_URL=...,OIC_INTEGRATION_INSTANCE=... `
  --project aiagent-capstoneproject
```

## Using Cloud Build

Build the image using Cloud Build:

```powershell
cd MCPServers\oic-monitor-server
gcloud builds submit --config=cloudbuild.yaml
```

This will build and push the image to Google Container Registry.

## Environment Variables

### Required Variables

- `OIC_CLIENT_ID` - OIC OAuth2 Client ID
- `OIC_CLIENT_SECRET` - OIC OAuth2 Client Secret
- `OIC_TOKEN_URL` - OIC OAuth2 Token URL
- `OIC_API_BASE_URL` - OIC Monitoring API Base URL
- `OIC_INTEGRATION_INSTANCE` - OIC Integration Instance name

### Optional Variables

- `OIC_SCOPE` - OAuth2 scope (default: `urn:opc:idm:__myscopes__`)
- `PORT` - Server port (default: 8080 for Cloud Run, 3000 for local)

## Service URLs

After deployment, get service URL:

```powershell
# Get service URL
gcloud run services describe oic-monitor-server --region us-central1 --format="value(status.url)"

# Test health endpoint
$url = gcloud run services describe oic-monitor-server --region us-central1 --format="value(status.url)"
Invoke-RestMethod -Uri "$url/health"
```

## Update Configuration

After deployment, update your MCP client configuration:

```python
# In your agent or client code
MCP_SERVER_URL = "https://oic-monitor-server-xxxxx.run.app/sse"
```

## Updating Services

To update a service after code changes:

```powershell
cd MCPServers\oic-monitor-server
.\deploy-to-cloud-run.ps1
```

Or manually:

```powershell
gcloud builds submit --tag gcr.io/aiagent-capstoneproject/oic-monitor-server:latest
gcloud run deploy oic-monitor-server --image gcr.io/aiagent-capstoneproject/oic-monitor-server:latest --region us-central1
```

## Monitoring

View logs:

```powershell
# All services
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=oic-monitor-server" --limit 50

# Specific service
gcloud run services logs read oic-monitor-server --region us-central1
```

## Cost Optimization

Cloud Run charges based on:
- **CPU and memory** allocated
- **Request count**
- **Request duration**

Default settings:
- CPU: 1 vCPU
- Memory: 512 MiB
- Min instances: 0 (scales to zero)
- Max instances: 10

To adjust:

```powershell
gcloud run services update oic-monitor-server `
  --cpu 2 `
  --memory 1Gi `
  --min-instances 1 `
  --max-instances 5 `
  --region us-central1
```

## Security

### Authentication

By default, services are deployed with `--allow-unauthenticated`. To require authentication:

```powershell
gcloud run services update oic-monitor-server `
  --no-allow-unauthenticated `
  --region us-central1
```

Then grant access:

```powershell
gcloud run services add-iam-policy-binding oic-monitor-server `
  --member="user:your-email@example.com" `
  --role="roles/run.invoker" `
  --region us-central1
```

## Troubleshooting

### Check Service Status

```powershell
gcloud run services describe oic-monitor-server --region us-central1
```

### View Recent Logs

```powershell
gcloud run services logs read oic-monitor-server --region us-central1 --limit 50
```

### Test Health Endpoints

```powershell
# Get service URL
$url = gcloud run services describe oic-monitor-server --region us-central1 --format="value(status.url)"

# Test health
curl "$url/health"

# Test root endpoint
curl "$url/"
```

### Permission Denied Errors

If you see `PERMISSION_DENIED` errors when running `gcloud builds submit`, your account lacks the required IAM roles.

**Error message:**
```
ERROR: (gcloud.builds.submit) PERMISSION_DENIED: The caller does not have permission.
```

**Solution:**

Ask a project owner to grant you the required roles:

```powershell
# Get your current account
$account = gcloud config get-value account

# Project owner runs these commands:
gcloud projects add-iam-policy-binding aiagent-capstoneproject `
  --member="user:$account" `
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding aiagent-capstoneproject `
  --member="user:$account" `
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding aiagent-capstoneproject `
  --member="user:$account" `
  --role="roles/run.admin"
```

**Required IAM Roles:**
- `roles/cloudbuild.builds.editor` - Submit Cloud Build jobs
- `roles/storage.admin` - Access Cloud Build storage buckets
- `roles/run.admin` - Deploy to Cloud Run

### Common Issues

1. **Build fails**: Check Dockerfile syntax and dependencies
2. **Deployment fails**: Verify environment variables are set
3. **Permission denied**: See "Permission Denied Errors" section above
4. **Service not accessible**: Check IAM permissions and authentication settings
5. **401 Authentication errors**: Verify OIC credentials are correct and token URL is accessible
6. **High latency**: Consider increasing CPU/memory or setting min-instances > 0

