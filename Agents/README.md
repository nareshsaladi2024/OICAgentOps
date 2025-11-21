# Monitor Queue Request Agent

Python agent using Google ADK to monitor Oracle Integration Cloud instances via MCP server.

## Installation

1. Create a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables (create `.env` file):
```
GOOGLE_API_KEY=your_google_api_key
MCP_SERVER_URL=http://localhost:3000
```

## Usage

### Run the agent directly:
```bash
python monitor_queue_request_agent.py
```

### Use with Google ADK:
```bash
adk run monitor_queue_request_agent
```

### Use with ADK web interface:
```bash
adk web --port 8000
```

## Agent Description

The `MonitorQueueRequestAgent` calls the MCP server's `monitoringInstances` tool with:
- Query: `{timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}`
- Default parameters: limit=50, offset=0, orderBy='lastupdateddate', fields='runId', return='summary'

## Response Format

The agent returns structured text with:
- Summary information (total records, time window, etc.)
- Detailed instance information (IDs, status, dates, tracking variables)
- Formatted for easy reading

## Integration with MCP Server

The agent communicates with the MCP server running at `http://localhost:3000` (or the URL specified in `MCP_SERVER_URL` environment variable).

### Two Versions Available:

1. **monitor_queue_request_agent.py** - Basic version with HTTP fallback
2. **monitor_queue_request_agent_mcp.py** - Full MCP SDK integration (recommended)

The MCP SDK version provides full protocol support and is recommended for production use.

### MCP Server Requirements:

- MCP server must be running on the specified URL
- Server should expose the `monitoringInstances` tool
- SSE (Server-Sent Events) transport must be enabled

