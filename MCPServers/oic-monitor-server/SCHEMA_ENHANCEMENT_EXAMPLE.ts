/**
 * Example: Enhanced Schema Definitions for MCP Server
 * 
 * This file shows how to enhance your schemas with more detailed specifications
 */

// Enhanced Common List Schema with better validation
const enhancedCommonListSchema = {
    q: { 
        type: "string", 
        description: "Filter query string. Supports OIC filter syntax. Example: {timewindow:'1h', status:'IN_PROGRESS'}",
        default: ""
    },
    orderBy: { 
        type: "string", 
        description: "Sort order. Valid values: 'lastupdateddate', 'createddate', 'name'. Use '-' prefix for descending (e.g., '-lastupdateddate')",
        default: "lastupdateddate"
    },
    limit: { 
        type: "number", 
        description: "Maximum number of items to return per page",
        minimum: 1,
        maximum: 1000,
        default: 50
    },
    offset: { 
        type: "number", 
        description: "Starting point for pagination (0-based index)",
        minimum: 0,
        default: 0
    }
};

// Enhanced Monitoring Instances Schema
const enhancedMonitoringInstancesSchema = {
    type: "object",
    properties: {
        ...enhancedCommonListSchema,
        fields: { 
            type: "string", 
            description: "Limit query results to specific fields. Valid values: 'runId', 'id', 'all'. Use 'all' for complete details.",
            enum: ["runId", "id", "all"],
            default: "runId"
        },
        groupBy: { 
            type: "string", 
            description: "Groups results by integration name. Valid values: 'integration'",
            enum: ["integration"],
            default: ""
        },
        status: {
            type: "string",
            description: "Filter by instance status",
            enum: ["IN_PROGRESS", "SUCCESS", "ERROR", "CANCELLED", "RETRY"],
            default: "IN_PROGRESS"
        },
        timeWindow: {
            type: "string",
            description: "Time window for filtering instances. Format: '1h' (1 hour), '24h' (24 hours), '7d' (7 days)",
            pattern: "^(\\d+)(h|d|m)$",
            default: "1h"
        }
    },
    required: [] // All fields are optional with defaults
};

// Enhanced Instance Details Schema
const enhancedMonitoringInstanceDetailsSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier of the integration instance. Format: UUID or instance ID from OIC.",
            pattern: "^[a-zA-Z0-9_-]+$",
            minLength: 1
        },
        includeLogs: {
            type: "boolean",
            description: "Include log entries in the response",
            default: false
        },
        includeActivityStream: {
            type: "boolean",
            description: "Include activity stream in the response",
            default: false
        }
    },
    required: ["id"]
};

// Enhanced Integrations Schema
const enhancedMonitoringIntegrationsSchema = {
    type: "object",
    properties: {
        ...enhancedCommonListSchema,
        return: { 
            type: "string", 
            description: "Type of records to return. Valid values: 'all', 'active', 'inactive'",
            enum: ["all", "active", "inactive"],
            default: "all"
        },
        integrationStyle: {
            type: "string",
            description: "Filter by integration style",
            enum: ["appdriven", "orchestration", "scheduled"],
            default: ""
        }
    },
    required: []
};

// Enhanced Agent Groups Schema
const enhancedMonitoringAgentGroupsSchema = {
    type: "object",
    properties: {
        q: { 
            type: "string", 
            description: "Filters results by agent group name. Supports partial matching.",
            default: ""
        },
        orderBy: { 
            type: "string", 
            description: "Orders results by 'name' or 'lastupdatedtime'",
            enum: ["name", "lastupdatedtime", "-name", "-lastupdatedtime"],
            default: "name"
        },
        includeAgents: {
            type: "boolean",
            description: "Include agent details in the response",
            default: false
        }
    },
    required: []
};

// Enhanced Logs Schema
const enhancedMonitoringLogsSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The ID of the integration instance to retrieve logs for",
            pattern: "^[a-zA-Z0-9_-]+$",
            minLength: 1
        },
        logLevel: {
            type: "string",
            description: "Filter logs by level",
            enum: ["ALL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"],
            default: "ALL"
        },
        lines: {
            type: "number",
            description: "Number of log lines to retrieve (most recent)",
            minimum: 1,
            maximum: 10000,
            default: 100
        },
        searchText: {
            type: "string",
            description: "Search for specific text in log entries",
            default: ""
        }
    },
    required: ["id"]
};

/**
 * Example Tool Registration with Enhanced Schema
 */
const exampleToolRegistration = {
    name: "monitoringInstances",
    description: `Retrieves integration instances with advanced filtering and pagination options.
    
    Features:
    - Filter by status, time window, and custom query
    - Pagination support with limit and offset
    - Field selection (runId, id, or all)
    - Grouping by integration name
    
    Example usage:
    - Get all IN_PROGRESS instances from last hour: { status: "IN_PROGRESS", timeWindow: "1h" }
    - Get first 10 instances: { limit: 10, offset: 0 }
    - Get all fields: { fields: "all" }`,
    inputSchema: enhancedMonitoringInstancesSchema
};

/**
 * Schema with Nested Objects Example
 */
const complexNestedSchema = {
    type: "object",
    properties: {
        filters: {
            type: "object",
            description: "Advanced filtering options",
            properties: {
                status: {
                    type: "array",
                    description: "Multiple status values to filter",
                    items: {
                        type: "string",
                        enum: ["IN_PROGRESS", "SUCCESS", "ERROR"]
                    },
                    minItems: 1,
                    maxItems: 5
                },
                dateRange: {
                    type: "object",
                    description: "Date range filter",
                    properties: {
                        start: {
                            type: "string",
                            description: "Start date in ISO 8601 format",
                            format: "date-time"
                        },
                        end: {
                            type: "string",
                            description: "End date in ISO 8601 format",
                            format: "date-time"
                        }
                    },
                    required: ["start", "end"]
                }
            }
        },
        pagination: {
            type: "object",
            description: "Pagination configuration",
            properties: {
                page: {
                    type: "number",
                    minimum: 1,
                    default: 1
                },
                pageSize: {
                    type: "number",
                    minimum: 1,
                    maximum: 100,
                    default: 50
                }
            }
        }
    },
    required: []
};

export {
    enhancedCommonListSchema,
    enhancedMonitoringInstancesSchema,
    enhancedMonitoringInstanceDetailsSchema,
    enhancedMonitoringIntegrationsSchema,
    enhancedMonitoringAgentGroupsSchema,
    enhancedMonitoringLogsSchema,
    exampleToolRegistration,
    complexNestedSchema
};

