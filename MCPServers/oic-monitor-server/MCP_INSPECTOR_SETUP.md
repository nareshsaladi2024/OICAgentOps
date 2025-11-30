# MCP Inspector Setup Guide

## Connecting to Streamable HTTP Transport

### URL Format

For MCP Inspector, use the **streamable HTTP** endpoint:

```
https://oic-monitor-server-xxx.run.app/stream
```

**NOT** `/sse` - that's for SSE transport only.

### Transport Type

In MCP Inspector, select:
- **Transport Type**: `streamableHttp` or `Streamable HTTP`
- **URL**: `https://oic-monitor-server-xxx.run.app/stream`

### Connection Steps

1. **Open MCP Inspector**: https://modelcontextprotocol.io/inspector

2. **Select Transport**: Choose "Streamable HTTP" or "streamableHttp"

3. **Enter URL**: 
   ```
   https://oic-monitor-server-xxx.run.app/stream
   ```

4. **Connect**: Click "Connect" or "Start Session"

### Troubleshooting

#### "Connection Failed" or Timeout

**Check 1: Server is running**
```powershell
# Check Cloud Run service status
gcloud run services describe oic-monitor-server --region us-central1
```

**Check 2: Endpoint is accessible**
```powershell
# Test health endpoint
curl https://oic-monitor-server-xxx.run.app/health
```

**Check 3: Stream endpoint responds**
```powershell
# Test stream endpoint (should return 200 or start SSE stream)
curl -X GET https://oic-monitor-server-xxx.run.app/stream
```

#### CORS Errors

The server is configured with CORS enabled. If you see CORS errors:
1. Verify the server has been rebuilt and redeployed
2. Check browser console for specific CORS error
3. Ensure you're using the correct URL (HTTPS, not HTTP)

#### "Method Not Allowed"

The `/stream` endpoint supports:
- `GET` - Establish connection/stream
- `POST` - Send messages
- `DELETE` - Close session
- `OPTIONS` - CORS preflight

If you see method errors, ensure MCP Inspector is using the correct HTTP methods.

#### No Response / Timeout

MCP Inspector has known issues with streamable HTTP transport. Try:

1. **Use SSE Transport Instead**:
   - Transport: `sse` or `SSE`
   - URL: `https://oic-monitor-server-xxx.run.app/sse`
   - Note: SSE requires separate POST endpoint for messages

2. **Check Server Logs**:
   ```powershell
   gcloud run services logs read oic-monitor-server --region us-central1 --limit 50
   ```

3. **Verify Environment Variables**:
   - Ensure all OIC credentials are set in Cloud Run
   - Check `.env` file was loaded during deployment

### Alternative: Use SSE Transport

If streamable HTTP doesn't work, use SSE transport:

**In MCP Inspector:**
- **Transport Type**: `sse` or `SSE`
- **URL**: `https://oic-monitor-server-xxx.run.app/sse`

**Note**: SSE transport uses:
- `GET /sse` - Connect
- `POST /messages` - Send messages

### Server Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/stream` | GET | Streamable HTTP - Connect |
| `/stream` | POST | Streamable HTTP - Send messages |
| `/stream` | DELETE | Streamable HTTP - Close session |
| `/sse` | GET | SSE Transport - Connect |
| `/messages` | POST | SSE Transport - Send messages |
| `/health` | GET | Health check |
| `/` | GET | Server info |

### Testing Connection

**Test with curl:**
```bash
# Test stream endpoint
curl -X GET https://oic-monitor-server-xxx.run.app/stream \
  -H "Accept: text/event-stream" \
  -v

# Test POST message
curl -X POST https://oic-monitor-server-xxx.run.app/stream \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Known Issues

1. **MCP Inspector Timeout**: There's a known issue where MCP Inspector doesn't properly correlate requests with responses in the GET SSE stream. This is a limitation of MCP Inspector, not the server.

2. **Workaround**: Use SSE transport (`/sse`) instead of streamable HTTP (`/stream`) if you encounter timeout issues.

### Server Configuration

The server is configured with:
- ✅ CORS enabled (all origins)
- ✅ JSON body parsing
- ✅ JSON responses enabled for streamable HTTP
- ✅ OPTIONS preflight handling
- ✅ Error handling

### After Deployment

1. **Rebuild server**:
   ```powershell
   npm run build
   ```

2. **Redeploy to Cloud Run**:
   ```powershell
   .\deploy-to-cloud-run.ps1
   ```

3. **Test connection** in MCP Inspector

4. **Check logs** if issues persist:
   ```powershell
   gcloud run services logs read oic-monitor-server --region us-central1 --follow
   ```

