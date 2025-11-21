# MCP Transport Types: SSE vs Streamable HTTP

This document explains the difference between SSE (Server-Sent Events) and Streamable HTTP transports in MCP servers.

## Overview

The Model Context Protocol (MCP) supports multiple transport mechanisms for communication between clients and servers. The OIC Monitor MCP Server currently supports **SSE transport** and can be extended to support **Streamable HTTP transport**.

## Server-Sent Events (SSE) Transport

### How It Works

SSE uses a **unidirectional** communication pattern:
- **Server → Client**: Long-lived HTTP connection with `text/event-stream` MIME type
- **Client → Server**: Separate HTTP POST requests

### Implementation

```typescript
// Server-side (current implementation)
this.app.get("/sse", async (req, res) => {
    transport = new SSEServerTransport("/messages", res);
    await this.server.connect(transport);
});

this.app.post("/messages", async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    }
});
```

### Client Connection

```typescript
// Client-side
const transport = new SSEClientTransport(
    new URL("http://localhost:3000/sse")
);
await client.connect(transport);
```

### Characteristics

- ✅ **Standardized**: Uses `text/event-stream` MIME type
- ✅ **Browser Support**: Native `EventSource` API support
- ✅ **Auto-reconnection**: Built-in reconnection handling
- ❌ **Unidirectional**: Server-to-client only (requires separate POST for client-to-server)
- ❌ **Text Only**: Limited to text-based data
- ❌ **Two Endpoints**: Requires `/sse` (GET) and `/messages` (POST)

### Use Case

Best for scenarios where:
- Server needs to push real-time updates to clients
- Client-to-server communication is infrequent
- You need automatic reconnection handling
- Browser compatibility is important

## Streamable HTTP Transport

### How It Works

Streamable HTTP uses **bidirectional** communication:
- **Both Directions**: Single HTTP connection can handle both request and response streaming
- **Flexible Format**: Can stream JSON, binary, or any format
- **Standard HTTP**: Uses standard HTTP requests/responses with streaming

### Implementation (Conceptual)

```typescript
// Server-side (would need to be implemented)
this.app.post("/stream", async (req, res) => {
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Create streamable transport
    const transport = new StreamableHTTPServerTransport(req, res);
    await this.server.connect(transport);
});
```

### Client Connection

```typescript
// Client-side
const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/stream")
);
await client.connect(transport);
```

### Characteristics

- ✅ **Bidirectional**: Single connection for both directions
- ✅ **Flexible**: Supports any data format (JSON, binary, etc.)
- ✅ **Standard HTTP**: Uses standard HTTP protocol
- ✅ **Single Endpoint**: One endpoint handles everything
- ❌ **Manual Reconnection**: Requires custom reconnection logic
- ❌ **More Complex**: More complex to implement correctly

### Use Case

Best for scenarios where:
- You need bidirectional communication over a single connection
- You need to stream binary data
- You want a single endpoint for all communication
- You're building a custom client/server implementation

## Key Differences Summary

| Feature | SSE Transport | Streamable HTTP Transport |
|---------|--------------|---------------------------|
| **Direction** | Unidirectional (server→client) | Bidirectional |
| **Endpoints** | 2 (`/sse` GET, `/messages` POST) | 1 (`/stream` POST) |
| **MIME Type** | `text/event-stream` | `application/json` or custom |
| **Reconnection** | Automatic | Manual |
| **Data Format** | Text only | Any format |
| **Complexity** | Simple | More complex |
| **Browser Support** | Native (`EventSource`) | Custom implementation |
| **Use Case** | Real-time updates, notifications | Full-duplex communication |

## Why `/sse` Works Only for SSE

The endpoint `http://localhost:3000/sse` is specifically configured for SSE transport:

1. **GET Request**: The `/sse` endpoint expects a GET request to establish the SSE connection
2. **Event Stream**: It sets `Content-Type: text/event-stream` and keeps the connection open
3. **Separate POST**: Client-to-server messages go to `/messages` via POST

For Streamable HTTP, you would need:
- A different endpoint (e.g., `/stream`)
- POST method (not GET)
- Different response headers
- Bidirectional streaming support

## Current Server Status

The OIC Monitor MCP Server currently implements **SSE transport only**.

### Endpoints:
- `GET /sse` - SSE connection endpoint
- `POST /messages` - Client-to-server messages
- `GET /health` - Health check
- `GET /` - Server information

### To Add Streamable HTTP Support:

1. Add a new endpoint (e.g., `/stream`)
2. Implement `StreamableHTTPServerTransport` (if available in MCP SDK)
3. Handle bidirectional streaming
4. Update client examples

## Recommendations

### Use SSE Transport When:
- ✅ You need simple server-to-client updates
- ✅ Browser compatibility is important
- ✅ You want automatic reconnection
- ✅ Text-based data is sufficient

### Use Streamable HTTP Transport When:
- ✅ You need bidirectional communication
- ✅ You need to stream binary data
- ✅ You want a single endpoint
- ✅ You're building a custom implementation

## Example: Connecting to SSE Endpoint

```typescript
// TypeScript/Node.js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
    new URL("http://localhost:3000/sse")
);
const client = new Client({ name: "my-client", version: "1.0.0" }, {});
await client.connect(transport);
```

```python
# Python
from mcp import Client
from mcp.client.sse import sse_client

async with sse_client("http://localhost:3000/sse") as (read, write):
    async with Client(read, write) as client:
        await client.initialize()
        result = await client.call_tool("monitoringInstances", {...})
```

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [HTTP Streaming](https://en.wikipedia.org/wiki/HTTP_streaming)

