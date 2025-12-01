# Environment Variables Setup Guide

## Error Fix

If you see: `"OIC authentication credentials not configured for environment prod3"`

You need to set environment-specific variables in your `.env` file.

## Required Variables Format

The server expects environment variables with environment suffixes:

- `OIC_CLIENT_ID_<ENV>` (e.g., `OIC_CLIENT_ID_PROD3`)
- `OIC_CLIENT_SECRET_<ENV>` (e.g., `OIC_CLIENT_SECRET_PROD3`)
- `OIC_TOKEN_URL_<ENV>` (e.g., `OIC_TOKEN_URL_PROD3`)

## Supported Environments

- `dev`
- `qa3`
- `prod1`
- `prod3`

## Quick Setup

### Option 1: Use Interactive Script

```powershell
.\setup-env.ps1 -Environment prod3
```

This will prompt you for:
- OIC_CLIENT_ID_PROD3
- OIC_CLIENT_SECRET_PROD3
- OIC_TOKEN_URL_PROD3
- OIC_API_BASE_URL_PROD3 (optional)
- OIC_SCOPE_PROD3 (optional)
- OIC_INTEGRATION_INSTANCE_PROD3 (optional)

### Option 2: Create .env File Manually

Create a `.env` file in the `oic-monitor-server` directory:

```env
# Production 3 Environment (required for your error)
OIC_CLIENT_ID_PROD3=your-actual-client-id
OIC_CLIENT_SECRET_PROD3=your-actual-client-secret
OIC_TOKEN_URL_PROD3=https://your-instance-prod3.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_API_BASE_URL_PROD3=https://your-instance-prod3.integration.ocp.oc-test.com/ic/api/integration/v1
OIC_SCOPE_PROD3=
OIC_INTEGRATION_INSTANCE_PROD3=

# Other environments (optional, but recommended)
OIC_CLIENT_ID_DEV=your-dev-client-id
OIC_CLIENT_SECRET_DEV=your-dev-client-secret
OIC_TOKEN_URL_DEV=https://your-instance-dev.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_API_BASE_URL_DEV=https://your-instance-dev.integration.ocp.oc-test.com/ic/api/integration/v1

OIC_CLIENT_ID_QA3=your-qa3-client-id
OIC_CLIENT_SECRET_QA3=your-qa3-client-secret
OIC_TOKEN_URL_QA3=https://your-instance-qa3.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_API_BASE_URL_QA3=https://your-instance-qa3.integration.ocp.oc-test.com/ic/api/integration/v1

OIC_CLIENT_ID_PROD1=your-prod1-client-id
OIC_CLIENT_SECRET_PROD1=your-prod1-client-secret
OIC_TOKEN_URL_PROD1=https://your-instance-prod1.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_API_BASE_URL_PROD1=https://your-instance-prod1.integration.ocp.oc-test.com/ic/api/integration/v1

# Server Configuration
PORT=3000
NODE_ENV=production
```

## Where to Get OIC Credentials

1. **OIC_CLIENT_ID**: OAuth2 Client ID from OIC console
2. **OIC_CLIENT_SECRET**: OAuth2 Client Secret from OIC console
3. **OIC_TOKEN_URL**: Usually `https://<your-instance>.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token`
4. **OIC_API_BASE_URL**: Usually `https://<your-instance>.integration.ocp.oc-test.com/ic/api/integration/v1`

## After Setup

1. **Restart the server** to load new environment variables
2. **Test** with the monitoringInstances tool:
   ```json
   {
     "environment": "prod3",
     "duration": "1h",
     "status": "IN_PROGRESS"
   }
   ```

## For Cloud Run Deployment

If deploying to Cloud Run, set environment variables:

```powershell
gcloud run services update oic-monitor-server \
  --set-env-vars OIC_CLIENT_ID_PROD3=your-id,OIC_CLIENT_SECRET_PROD3=your-secret,OIC_TOKEN_URL_PROD3=your-url \
  --region us-central1
```

Or use the script:
```powershell
.\set-cloud-run-env-vars.ps1
```

## Troubleshooting

- **Error persists**: Make sure `.env` file is in the `oic-monitor-server` directory
- **Wrong format**: Variables must have environment suffix (e.g., `_PROD3`)
- **Not loading**: Restart the server after creating/updating `.env`
- **Cloud Run**: Environment variables must be set in Cloud Run service configuration



