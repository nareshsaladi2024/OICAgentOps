# OIC AgentOps - Oracle Integration Cloud Agent Operations

A comprehensive AI agent system for monitoring, managing, and automating Oracle Integration Cloud (OIC) operations using Google Agent Development Kit (ADK) and the Model Context Protocol (MCP).

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OIC AgentOps                              │
├─────────────────────────────────────────────────────────────────┤
│  Agents (Google ADK)          │  MCP Server (Node.js)           │
│  ├── CoordinatorAgent         │  └── oic-monitor-server         │
│  ├── MonitorErrorsAgent       │      ├── monitoringInstances    │
│  ├── MonitorQueueRequestAgent │      ├── monitoringErrors       │
│  ├── ResubmitErrorsAgent      │      ├── resubmitErrors         │
│  └── RecoveryJobAgent         │      └── recoveryJobDetails     │
├─────────────────────────────────────────────────────────────────┤
│  A2A Protocol Support         │  Shared State Management        │
│  ├── Agent Cards (JSON)       │  └── shared_state.json          │
│  └── A2A Servers (FastAPI)    │                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
OICAgentOps/
├── Agents/
│   ├── CoordinatorAgent/       # Orchestrates workflow
│   ├── MonitorErrorsAgent/     # Monitors OIC errors
│   ├── MonitorQueueRequestAgent/ # Monitors queue requests
│   ├── ResubmitErrorsAgent/    # Bulk resubmits errors
│   ├── RecoveryJobAgent/       # Tracks recovery jobs
│   ├── start_a2a_servers.py    # A2A launcher
│   ├── a2a_generator.py        # A2A generator utility
│   └── shared_state.json       # Inter-agent state
├── MCPServers/
│   └── oic-monitor-server/     # MCP server for OIC API
└── docs/                       # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+ with miniconda
- Node.js 18+ 
- Google Cloud account with Vertex AI enabled
- Oracle Integration Cloud credentials

### 1. Environment Setup

```bash
# Clone and navigate to project
cd /home/naresh/Capstone

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start MCP Server

```bash
cd OICAgentOps/MCPServers/oic-monitor-server
export PATH="$HOME/node/node-v24.11.1-linux-x64/bin:$PATH"
npm run build
node dist/src/index.js
```

### 3. Start ADK Web Server

```bash
cd OICAgentOps/Agents
export PATH="/home/naresh/miniconda3/bin:$PATH"
adk web --port 8001
```

### 4. Access the UI

Open http://127.0.0.1:8001/dev-ui/ and select an agent.

## 📚 Documentation

- [MCP Server Guide](docs/MCP_SERVER.md)
- [Agents Guide](docs/AGENTS.md)
- [A2A Protocol Guide](docs/A2A_PROTOCOL.md)
- [API Reference](docs/API_REFERENCE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🔧 Available Agents

| Agent | Description | Port (A2A) |
|-------|-------------|------------|
| CoordinatorAgent | Orchestrates error monitoring and recovery | 10001 |
| MonitorErrorsAgent | Retrieves errored integration instances | 10002 |
| MonitorQueueRequestAgent | Monitors queue requests | 10003 |
| ResubmitErrorsAgent | Bulk resubmits errors | 10004 |
| RecoveryJobAgent | Checks recovery job status | 10005 |

## 🌐 Environments Supported

- `dev` - Development
- `qa3` - QA Environment 3
- `prod1` - Production 1
- `prod3` - Production 3

## 📄 License

MIT License - See LICENSE file for details.
