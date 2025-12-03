export const environmentSchema = {
    environment: {
        type: "string",
        description: "OIC environment to query. Required. Enum values: 'dev', 'qa3', 'prod1', 'prod3'",
        enum: ["dev", "qa3", "prod1", "prod3"]
    }
};

export const commonListSchema = {
    environment: {
        type: "string",
        description: "OIC environment to query. Required. Enum values: 'dev', 'qa3', 'prod1', 'prod3'",
        enum: ["dev", "qa3", "prod1", "prod3"]
    },
    q: {
        type: "string",
        description: `Filter parameters using OIC query syntax. Supports multiple filters combined with commas.
        
Filter options:
- timewindow: '1h', '6h', '1d', '2d', '3d', 'RETENTIONPERIOD' (default: '1h')
- code: Integration identifier
- version: Integration version
- minDuration: Minimum duration in milliseconds
- maxDuration: Maximum duration in milliseconds
- status: 'COMPLETED', 'FAILED', 'ABORTED'
- startdate: Start date/time in UTC format (within 32 days retention)
- enddate: End date/time in UTC format (within 32 days retention)
- primaryValue: Search primary variable values (use '"value"' for multi-word, '[value]' for exact match)
- secondaryValue: Search secondary/tertiary variable values
- tertiaryValue: Search tertiary variable values
- primaryName: Primary variable name
- secondaryName: Secondary variable name
- tertiaryName: Tertiary variable name
- businessIDValue: Search across primary, secondary, tertiary variables
- jobid: Recovery job identifier
- runId: Run identifier of scheduled integration instance
- requestId: Request ID for scheduled orchestrations
- id: Integration instance identifier
- instanceId: Integration instance identifier
- includePurged: 'yes', 'no', 'onlyPurged'
- parentInstanceId: Parent integration instance identifier
- projectCode: Project identifier
- integration-style: 'appdriven' or 'scheduled'

Example: timewindow:'1h', status:'FAILED', code:'ERROR', version:'01.00.0000'`,
        default: ""
    },
    orderBy: {
        type: "string",
        description: "Sort order. Valid values: 'lastupdateddate', 'creationdate', 'executiontime'. Default: 'lastupdateddate'",
        enum: ["lastupdateddate", "creationdate", "executiontime"],
        default: "lastupdateddate"
    }
    // Note: limit and offset are handled internally by the pagination mechanism
    // All records are automatically retrieved using date-based pagination
};

export const monitoringInstancesSchema = {
    type: "object",
    properties: {
        duration: {
            type: "string",
            description: "Time window duration for retrieving instances. Required. Enum values: '1h', '6h', '1d', '2d', '3d', 'RETENTIONPERIOD'",
            enum: ["1h", "6h", "1d", "2d", "3d", "RETENTIONPERIOD"]
        },
        status: {
            type: "string",
            description: "Status filter for integration instances. Required. Enum values: 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABORTED'",
            enum: ["IN_PROGRESS", "COMPLETED", "FAILED", "ABORTED"]
        },
        environment: {
            type: "string",
            description: "OIC environment to query. Required. Enum values: 'dev', 'qa3', 'prod1', 'prod3'",
            enum: ["dev", "qa3", "prod1", "prod3"]
        }
    },
    required: ["duration", "status", "environment"]
};

export const monitoringInstanceDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the integration instance. This is the instance ID returned from the instances list endpoint.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringIntegrationsSchema = {
    type: "object",
    properties: {
        environment: {
            type: "string",
            description: "OIC environment to query. Required. Enum values: 'dev', 'qa3', 'prod1', 'prod3'",
            enum: ["dev", "qa3", "prod1", "prod3"]
        },
        q: {
            type: "string",
            description: "Filter query string. Example: {status:'ACTIVATED'}",
            default: ""
        },
        return: {
            type: "string",
            description: "Type of records to return. Controls the response data format. Valid values: 'all' (all records), 'active' (active integrations only), 'inactive' (inactive integrations only).",
            enum: ["all", "active", "inactive"],
            default: "all"
        }
        // Note: orderBy is NOT supported by this endpoint
    },
    required: ["environment"]
};

export const monitoringIntegrationDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (integrationId) of the integration. This can be the integration code or integration ID.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringAgentGroupsSchema = {
    type: "object",
    properties: {
        ...environmentSchema,
        q: {
            type: "string",
            description: "Filter query string to filter results by agent group name. Supports partial matching and search patterns.",
            default: ""
        },
        orderBy: {
            type: "string",
            description: "Sort order for results. Valid values: 'name' (by agent group name), 'lastupdatedtime' (by last updated time). Prefix with '-' for descending order (e.g., '-name').",
            default: "name"
        }
    },
    required: ["environment"]
};

export const monitoringAgentGroupDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier of the agent group. This is the agent group ID returned from the agent groups list endpoint.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringAgentsInGroupSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier of the agent group to retrieve agents for. This is the agent group ID returned from the agent groups list endpoint.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringAuditRecordsSchema = {
    type: "object",
    properties: commonListSchema,
    required: ["environment"]
};

export const monitoringErrorRecoveryJobsSchema = {
    type: "object",
    properties: commonListSchema,
    required: ["environment"]
};

export const monitoringErroredInstancesSchema = {
    type: "object",
    properties: {
        duration: {
            type: "string",
            description: "Time window duration for retrieving errored instances. Valid values: '1h', '6h', '1d', '2d', '3d', 'RETENTIONPERIOD'",
            enum: ["1h", "6h", "1d", "2d", "3d", "RETENTIONPERIOD"],
            default: "1h"
        },
        environment: {
            type: "string",
            description: "OIC environment to query. Required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'",
            enum: ["dev", "qa3", "prod1", "prod3"]
        }
    },
    required: ["environment"]
};

export const monitoringScheduledRunsSchema = {
    type: "object",
    properties: commonListSchema,
    required: ["environment"]
};

export const monitoringActivityStreamSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the integration instance to retrieve the activity stream for. This is the instance ID returned from the instances list endpoint.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringLogsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the integration instance to retrieve logs for. This is the instance ID returned from the instances list endpoint.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringAbortInstanceSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the integration instance to abort.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringDiscardErroredInstanceSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the errored integration instance to discard.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringDiscardErroredInstancesSchema = {
    type: "object",
    properties: {
        ...commonListSchema
    },
    required: ["environment"]
};

export const monitoringResubmitErroredInstanceSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the errored integration instance to resubmit.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringResubmitErroredInstancesSchema = {
    type: "object",
    properties: {
        environment: {
            type: "string",
            description: "OIC environment to query. Required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'",
            enum: ["dev", "qa3", "prod1", "prod3"]
        },
        instanceIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of instance IDs to resubmit. Required."
        }
    },
    required: ["environment", "instanceIds"]
};

export const monitoringErrorRecoveryJobDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier of the error recovery job.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringErroredInstanceDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the errored integration instance.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "environment"]
};

export const monitoringHistorySchema = {
    type: "object",
    properties: {
        ...commonListSchema
    },
    required: ["environment"]
};

export const monitoringActivityStreamDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier (instanceId) of the integration instance.",
            minLength: 1
        },
        key: {
            type: "string",
            description: "The key of the activity stream detail to retrieve. Required for downloading large payload.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "key", "environment"]
};

export const monitoringMessageCountSummarySchema = {
    type: "object",
    properties: {
        ...commonListSchema
    },
    required: ["environment"]
};

export const monitoringAgentDetailsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The unique identifier of the agent group.",
            minLength: 1
        },
        key: {
            type: "string",
            description: "The unique identifier (key) of the agent within the agent group.",
            minLength: 1
        },
        ...environmentSchema
    },
    required: ["id", "key", "environment"]
};

