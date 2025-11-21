# Oracle Integration Cloud Monitoring API Endpoints

This document lists all Oracle Integration Cloud monitoring API endpoints and their corresponding MCP server tools.

## Base URL
`/ic/api/integration/v1/monitoring`

## All Monitoring Endpoints

### 1. Retrieve Integration Instances
- **Endpoint**: `GET /instances`
- **MCP Tool**: `monitoringInstances`
- **Description**: Retrieve information about integration instances for the past hour (default) ordered by last updated time
- **Reference**: https://docs.oracle.com/en/cloud/paas/application-integration/rest-api/op-ic-api-integration-v1-monitoring-instances-get.html

**Query Parameters:**
- `fields`: string (runId, id, all)
- `groupBy`: string (integration)
- `integrationInstance`: string (required) - Service instance name
- `limit`: integer - Maximum items per page
- `offset`: integer - Starting point for pagination
- `orderBy`: string (lastupdateddate, creationdate, executiontime)
- `q`: string - Filter parameters
- `return`: string (metadataminimal, metadata, minimal, summary)

### 2. Retrieve Integration Instance Details
- **Endpoint**: `GET /instances/{id}`
- **MCP Tool**: `monitoringInstanceDetails`
- **Description**: Retrieve detailed information about a specific integration instance

**Path Parameters:**
- `id`: string (required) - Instance ID

### 3. Retrieve Integrations
- **Endpoint**: `GET /integrations`
- **MCP Tool**: `monitoringIntegrations`
- **Description**: Retrieve a list of integrations with optional filtering

**Query Parameters:**
- `limit`: integer
- `offset`: integer
- `q`: string - Filter parameters
- `orderBy`: string
- `return`: string - Type of records to return

### 4. Retrieve Integration Details
- **Endpoint**: `GET /integrations/{id}`
- **MCP Tool**: `monitoringIntegrationDetails`
- **Description**: Retrieve detailed information about a specific integration

**Path Parameters:**
- `id`: string (required) - Integration ID

### 5. Retrieve Agent Groups
- **Endpoint**: `GET /agentgroups`
- **MCP Tool**: `monitoringAgentGroups`
- **Description**: Retrieve a list of agent groups

**Query Parameters:**
- `q`: string - Filter by agent group name
- `orderBy`: string - Sort order

### 6. Retrieve Agent Group Details
- **Endpoint**: `GET /agentgroups/{id}`
- **MCP Tool**: `monitoringAgentGroupDetails`
- **Description**: Retrieve detailed information about a specific agent group

**Path Parameters:**
- `id`: string (required) - Agent group ID

### 7. Retrieve Agents in Group
- **Endpoint**: `GET /agentgroups/{id}/agents`
- **MCP Tool**: `monitoringAgentsInGroup`
- **Description**: Retrieve a list of agents belonging to a specific agent group

**Path Parameters:**
- `id`: string (required) - Agent group ID

### 8. Retrieve Audit Records
- **Endpoint**: `GET /auditRecords`
- **MCP Tool**: `monitoringAuditRecords`
- **Description**: Retrieve audit records with optional filtering and pagination

**Query Parameters:**
- `limit`: integer
- `offset`: integer
- `q`: string - Filter parameters
- `orderBy`: string

### 9. Retrieve Error Recovery Jobs
- **Endpoint**: `GET /errorRecoveryJobs`
- **MCP Tool**: `monitoringErrorRecoveryJobs`
- **Description**: Retrieve error recovery jobs that handle bulk resubmission of errored integration instances

**Query Parameters:**
- `limit`: integer
- `offset`: integer
- `q`: string - Filter parameters
- `orderBy`: string

### 10. Retrieve Errored Instances
- **Endpoint**: `GET /erroredInstances`
- **MCP Tool**: `monitoringErroredInstances`
- **Description**: Retrieve integration instances that have encountered errors

**Query Parameters:**
- `limit`: integer
- `offset`: integer
- `q`: string - Filter parameters
- `orderBy`: string

### 11. Retrieve Scheduled Runs
- **Endpoint**: `GET /scheduledruns`
- **MCP Tool**: `monitoringScheduledRuns`
- **Description**: Retrieve scheduled integration runs (applies to scheduled orchestrations)

**Query Parameters:**
- `limit`: integer
- `offset`: integer
- `q`: string - Filter parameters
- `orderBy`: string

### 12. Retrieve Activity Stream
- **Endpoint**: `GET /instances/{id}/activitystream`
- **MCP Tool**: `monitoringActivityStream`
- **Description**: Retrieve the activity stream for a specific integration instance

**Path Parameters:**
- `id`: string (required) - Instance ID

### 13. Retrieve Logs
- **Endpoint**: `GET /logs/{id}`
- **MCP Tool**: `monitoringLogs`
- **Description**: Retrieve log entries for a specific integration instance

**Path Parameters:**
- `id`: string (required) - Instance ID

## Implementation Status

✅ All 13 monitoring endpoints are implemented in the MCP server.

## Common Query Parameters

Most endpoints support these common parameters:

- **`q`**: Filter query string with OIC syntax
  - Supports: timewindow, status, code, version, dates, tracking variables, etc.
- **`limit`**: Maximum items per page (1-1000, default: 50)
- **`offset`**: Starting point for pagination (0-based, default: 0)
- **`orderBy`**: Sort order (varies by endpoint)
- **`integrationInstance`**: Required for all endpoints (added automatically by server)

## Response Formats

- **`metadataminimal`**: Fast response with minimal metadata
- **`metadata`**: Metadata including names
- **`minimal`**: Minimal information for faster response
- **`summary`**: Default complete response (default)

