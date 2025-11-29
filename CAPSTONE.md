# OICAgentOps - Capstone Project

## Architecture Overview

![Capstone Architecture](capstone.png)

## Project Summary

**OICAgentOps** is an AI-powered monitoring and automation platform for Oracle Integration Cloud (OIC). It combines Google ADK-based AI agents with a Model Context Protocol (MCP) server to provide intelligent monitoring, error detection, and automated recovery capabilities.

---

## Components

### AI Agents Layer

| Agent | Description |
|-------|-------------|
| **CoordinatorAgent** | Central orchestrator that coordinates all monitoring tasks |
| **MonitorQueueRequestAgent** | Monitors instance queues and tracks pending requests |
| **MonitorErrorsAgent** | Detects and tracks integration errors |
| **RecoveryJobAgent** | Manages error recovery job execution |
| **ResubmitErrorsAgent** | Handles resubmission of failed instances |

### MCP Server Layer

The OIC Monitor MCP Server (TypeScript/Express) exposes 20+ tools:

- `monitoringInstances` - List and query instances
- `monitoringErroredInstances` - Track errored instances
- `monitoringErrorRecoveryJobs` - Manage recovery jobs
- `monitoringIntegrations` - Integration status and details
- `monitoringActivityStream` - Real-time activity monitoring
- And 15+ more specialized tools

### Transport Layer

| Transport | Endpoints |
|-----------|-----------|
| **SSE** | `GET /sse` + `POST /messages` |
| **Streamable HTTP** | `GET/POST/DELETE /stream` |

### Oracle Integration Cloud

Supports multiple environments:
- **dev** - Development
- **qa3** - QA Testing
- **prod1** - Production 1
- **prod3** - Production 3

---

## Technology Stack

- **Backend**: TypeScript, Express.js, MCP SDK
- **AI**: Google ADK, Gemini LLM, Python
- **Protocol**: Model Context Protocol (MCP)
- **Target**: Oracle Integration Cloud REST API

