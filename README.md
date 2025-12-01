# OICAgentOps

**AI-powered monitoring and automation for Oracle Integration Cloud (OIC) with intelligent error detection and automated recovery.**

## Overview

OICAgentOps provides real-time monitoring, intelligent error detection, and automated recovery for Oracle Integration Cloud instances. The system leverages Google ADK agents and Gemini LLM to provide AI-powered insights and automated remediation.

## Key Features

### 1. Real-Time OIC Monitoring
- Monitor OIC instances, integrations, and activity streams
- Track instance lifecycle and states
- Comprehensive audit logs and activity tracking

### 2. Intelligent Error Detection
- Automatic detection of integration errors
- Detailed error analysis with AI-powered insights
- Error categorization and prioritization

### 3. Automated Error Recovery
- Automated recovery job management
- Intelligent resubmission of failed instances
- Recovery status tracking and monitoring

### 4. Multi-Environment Support
- Development, QA3, Production 1, and Production 3 environments
- Environment-specific OAuth token management
- Separate configuration per environment

### 5. MCP Server Integration
- Model Context Protocol (MCP) server for tool exposure
- Support for both SSE and Streamable HTTP transports
- Remote agent connectivity

## Architecture

```
OICAgentOps/
├── MCPServers/
│   └── oic-monitor-server/    # MCP server for OIC monitoring tools
├── Agents/
│   ├── CoordinatorAgent/      # Central orchestrator
│   ├── MonitorQueueRequestAgent/
│   ├── MonitorErrorsAgent/
│   ├── RecoveryJobAgent/
│   └── ResubmitErrorsAgent/
└── postman/                   # API testing collections
```

## Quick Start

### Prerequisites

- Node.js 18+ (for MCP server)
- Python 3.11+ (for agents)
- Google ADK (`adk`)
- Docker (optional, for containerized deployment)

### MCP Server Setup

```powershell
# Navigate to MCP server
cd MCPServers/oic-monitor-server

# Install dependencies
npm install

# Configure environment
# Copy .env.example to .env and configure OIC credentials
# Set OIC_CLIENT_ID, OIC_CLIENT_SECRET, OIC_TOKEN_URL for each environment

# Start server locally
npm start

# Or use Docker
docker-compose up -d
```

### Deploy MCP Server to Cloud Run

```powershell
cd MCPServers/oic-monitor-server
.\deploy-to-cloud-run.ps1
```

### Run Agents

```powershell
# Run CoordinatorAgent
cd Agents/CoordinatorAgent
python agent.py

# Run MonitorErrorsAgent
cd Agents/MonitorErrorsAgent
python agent.py

# Run other agents similarly
```

### Deploy Agents to Vertex AI Agent Engine

```powershell
cd Agents
.\deploy-all-agents-to-agent-engine.ps1
```

## MCP Server Tools

The OIC Monitor MCP server provides the following tools:

### Instances & Details
- `monitoringInstances` - List OIC instances with filtering
- `monitoringInstanceDetails` - Get detailed instance information

### Integrations & Status
- `monitoringIntegrations` - List integrations
- `monitoringIntegrationDetails` - Get integration details

### Error Management
- `monitoringErroredInstances` - List errored instances
- `monitoringErroredInstanceDetails` - Get error details

### Recovery Operations
- `monitoringErrorRecoveryJobs` - List recovery jobs
- `monitoringResubmitErroredInstance` - Resubmit failed instances

### Activity & Audit Logs
- `monitoringActivityStream` - Get activity stream
- `monitoringAuditRecords` - Get audit records
- `monitoringLogs` - Get system logs

### Agent Groups
- `monitoringAgentGroups` - List agent groups
- `monitoringAgentsInGroup` - Get agents in a group

## AI Agents

### CoordinatorAgent
Central orchestrator that manages and coordinates all monitoring operations. Integrates with the MCP server to monitor OIC instances and trigger recovery actions.

### MonitorQueueRequestAgent
Monitors the OIC instance queue, tracking pending and in-progress requests.

### MonitorErrorsAgent
Detects integration errors and provides detailed error analysis using AI-powered insights.

### RecoveryJobAgent
Manages error recovery jobs, tracking their status and execution.

### ResubmitErrorsAgent
Handles the resubmission of failed integration instances with intelligent retry logic.

## Environment Configuration

### Supported Environments

| Environment | Purpose |
|-------------|---------|
| **dev** | Local development and testing |
| **qa3** | Quality assurance testing |
| **prod1** | Primary production environment |
| **prod3** | Secondary production environment |

### Environment Variables

Each environment requires OAuth2 credentials in the `.env` file:

```env
# Development
OIC_CLIENT_ID_DEV=your_client_id
OIC_CLIENT_SECRET_DEV=your_client_secret
OIC_TOKEN_URL_DEV=https://your-instance.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_BASE_URL_DEV=https://your-instance.integration.ocp.oc-test.com
INTEGRATION_INSTANCE_DEV=your_integration_instance

# Production 3
OIC_CLIENT_ID_PROD3=your_client_id
OIC_CLIENT_SECRET_PROD3=your_client_secret
OIC_TOKEN_URL_PROD3=https://your-instance.integration.ocp.oc-test.com/ic/api/integration/v1/oauth2/token
OIC_BASE_URL_PROD3=https://your-instance.integration.ocp.oc-test.com
INTEGRATION_INSTANCE_PROD3=your_integration_instance
```

## MCP Transport Support

The OIC Monitor MCP server supports both transport types:

### Server-Sent Events (SSE)
- Endpoint: `/sse`
- Unidirectional streaming
- Best for: Simple client-server communication

### Streamable HTTP
- Endpoint: `/stream`
- Bidirectional streaming
- Best for: Remote agent connections, MCP Inspector

See [REMOTE_STREAMABLE_HTTP.md](REMOTE_STREAMABLE_HTTP.md) for details.

## Documentation

- [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md) - Comprehensive project overview
- [CAPSTONE.md](CAPSTONE.md) - Capstone project details
- [REMOTE_STREAMABLE_HTTP.md](REMOTE_STREAMABLE_HTTP.md) - MCP transport guide
- [DOCKER_README.md](DOCKER_README.md) - Docker deployment guide

## Deployment

### MCP Server to Cloud Run

```powershell
cd MCPServers/oic-monitor-server
.\deploy-to-cloud-run.ps1
```

### Agents to Vertex AI Agent Engine

```powershell
cd Agents
.\deploy-all-agents-to-agent-engine.ps1
```

## Technology Stack

### Backend
- **TypeScript**: Primary language for MCP server
- **Express.js**: HTTP server framework
- **MCP SDK**: Model Context Protocol implementation

### AI
- **Google ADK**: Agent Development Kit for building AI agents
- **Gemini LLM**: Large language model for intelligent processing
- **Python**: Agent implementation language

## Repository

- **GitHub**: [OICAgentOps](https://github.com/nareshsaladi2024/OICAgentOps)
- **License**: MIT

## Contributing

This is a capstone project. Contributions and feedback are welcome.

