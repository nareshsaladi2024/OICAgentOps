# Streamable HTTP Transport Fix for MCP Inspector

## Issue

MCP Inspector cannot connect to `/stream` endpoint using streamable HTTP transport, but SSE transport (`/sse`) works fine.

## Root Cause

MCP Inspector has **known issues** with streamable HTTP transport:
- Doesn't properly correlate requests with responses in GET SSE stream
- Timeout issues when using streamable HTTP
- Better support for SSE transport

Reference: [MCP Inspector Issue #614](https://github.com/modelcontextprotocol/inspector/issues/614)

## Solution: Use SSE Transport Instead

**Recommended approach**: Use SSE transport which works reliably with MCP Inspector.

### MCP Inspector Configuration (SSE)

- **Transport Type**: `sse` or `SSE`
- **URL**: `https://oic-monitor-server-1276251306.us-central1.run.app/sse`

### How SSE Works

1. **Connect**: `GET /sse` - Establishes SSE connection
2. **Send Messages**: `POST /messages` - Client-to-server messages
3. **Receive**: Server sends responses via SSE stream

## If You Must Use Streamable HTTP

### Current Implementation

The server supports streamable HTTP at `/stream`:
- `GET /stream` - Establish connection
- `POST /stream` - Send messages
- `DELETE /stream` - Close session

### Configuration

1. **Rebuild server**:
   ```powershell
   npm run build
   ```

2. **Redeploy to Cloud Run**:
   ```powershell
   .\deploy-to-cloud-run.ps1
   ```

3. **Test connection**:
   ```powershell
   curl -X GET https://oic-monitor-server-xxx.run.app/stream -v
   ```

### Troubleshooting Streamable HTTP

**Check server logs**:
```powershell
gcloud run services logs read oic-monitor-server --region us-central1 --limit 50
```

Look for:
- `[StreamableHTTP] Session initialized` - Connection successful
- `[StreamableHTTP] Handling GET request` - Request received
- Error messages - Connection issues

**Common Issues**:

1. **Timeout**: MCP Inspector times out waiting for response
   - **Fix**: Use SSE transport instead

2. **CORS Errors**: Browser blocks request
   - **Fix**: CORS is configured, but check browser console

3. **Connection Refused**: Server not responding
   - **Fix**: Verify server is running and accessible

4. **Method Not Allowed**: Wrong HTTP method
   - **Fix**: Ensure using GET for initial connection

## Comparison: SSE vs Streamable HTTP

| Feature | SSE (`/sse`) | Streamable HTTP (`/stream`) |
|---------|--------------|------------------------------|
| **MCP Inspector Support** | ✅ Works | ⚠️ Known issues |
| **Endpoints** | 2 (`/sse`, `/messages`) | 1 (`/stream`) |
| **Connection** | GET `/sse` | GET `/stream` |
| **Messages** | POST `/messages` | POST `/stream` |
| **Reliability** | ✅ Stable | ⚠️ Timeout issues |

## Recommendation

**Use SSE transport** for MCP Inspector:
- More reliable
- Better MCP Inspector support
- Proven to work

**URL**: `https://oic-monitor-server-1276251306.us-central1.run.app/sse`
**Transport**: `sse`

## Server Status

Both transports are implemented:
- ✅ **SSE Transport**: `/sse` - **Recommended for MCP Inspector**
- ⚠️ **Streamable HTTP**: `/stream` - Has known MCP Inspector issues

The server is configured correctly. The issue is with MCP Inspector's handling of streamable HTTP transport, not the server implementation.



