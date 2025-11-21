import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
import express from "express";

import cors from "cors";
import { CONFIG } from "./config.js";
import { TokenManager } from "./tokenManager.js";

// Interface for OIC Response
interface OicResponse {
    totalRecordsCount?: number;
    items?: any[];
    [key: string]: any;
}

// --- Schemas ---

const commonListSchema = {
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

Example: {timewindow:'1h', status:'FAILED', code:'ERROR', version:'01.00.0000'}`,
        default: "{timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}"
    },
    orderBy: { 
        type: "string", 
        description: "Sort order. Valid values: 'lastupdateddate', 'creationdate', 'executiontime'. Default: 'lastupdateddate'",
        enum: ["lastupdateddate", "creationdate", "executiontime"],
        default: "lastupdateddate"
    },
    limit: { 
        type: "number", 
        description: "Maximum number of items to return per page. Use with offset for pagination.",
        minimum: 1,
        maximum: 1000,
        default: 50
    },
    offset: { 
        type: "number", 
        description: "Starting point for pagination (0-based index). Use with limit for pagination. Example: offset=3&limit=16 returns items starting at 4th position.",
        minimum: 0,
        default: 0
    }
};

const monitoringInstancesSchema = {
    type: "object",
    properties: {
        ...commonListSchema,
        fields: { 
            type: "string", 
            description: "Limit query results to specific fields. Valid values: 'runId' (returns only runId), 'id' (returns only id), 'all' (returns all fields). Use 'runId' or 'id' for faster responses.",
            enum: ["runId", "id", "all"],
            default: "runId"
        },
        groupBy: { 
            type: "string", 
            description: "Groups results by integration name. Valid value: 'integration'",
            enum: ["integration"],
            default: ""
        },
        return: {
            type: "string",
            description: `Controls the response data format. Valid values:
- 'metadataminimal': Fast response with metadata only (instanceId, integrationId, integrationVersion, status). No integration/project names.
- 'metadata': Metadata including integration and project names if available.
- 'minimal': Minimal information for faster response. Integration/project names may be default values.
- 'summary': Default response format. Contains complete instance data without non-primary tracking variables.`,
            enum: ["metadataminimal", "metadata", "minimal", "summary"],
            default: "summary"
        }
    },
};

const monitoringInstanceDetailsSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier (instanceId) of the integration instance. This is the instance ID returned from the instances list endpoint.",
            minLength: 1
        }
    },
    required: ["id"]
};

const monitoringIntegrationsSchema = {
    type: "object",
    properties: {
        ...commonListSchema,
        return: { 
            type: "string", 
            description: "Type of records to return. Controls the response data format. Valid values: 'all' (all records), 'active' (active integrations only), 'inactive' (inactive integrations only).",
            enum: ["all", "active", "inactive"],
            default: "all"
        }
    },
};

const monitoringIntegrationDetailsSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier (integrationId) of the integration. This can be the integration code or integration ID.",
            minLength: 1
        }
    },
    required: ["id"]
};

const monitoringAgentGroupsSchema = {
    type: "object",
    properties: {
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
};

const monitoringAgentGroupDetailsSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier of the agent group. This is the agent group ID returned from the agent groups list endpoint.",
            minLength: 1
        }
    },
    required: ["id"]
};

const monitoringAgentsInGroupSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier of the agent group to retrieve agents for. This is the agent group ID returned from the agent groups list endpoint.",
            minLength: 1
        }
    },
    required: ["id"]
};

const monitoringAuditRecordsSchema = {
    type: "object",
    properties: commonListSchema
};

const monitoringErrorRecoveryJobsSchema = {
    type: "object",
    properties: commonListSchema
};

const monitoringErroredInstancesSchema = {
    type: "object",
    properties: commonListSchema
};

const monitoringScheduledRunsSchema = {
    type: "object",
    properties: commonListSchema
};

const monitoringActivityStreamSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier (instanceId) of the integration instance to retrieve the activity stream for. This is the instance ID returned from the instances list endpoint.",
            minLength: 1
        }
    },
    required: ["id"]
};

const monitoringLogsSchema = {
    type: "object",
    properties: {
        id: { 
            type: "string", 
            description: "The unique identifier (instanceId) of the integration instance to retrieve logs for. This is the instance ID returned from the instances list endpoint.",
            minLength: 1
        }
    },
    required: ["id"]
};

class OicMonitorServer {
    private server: Server;
    private tokenManager: TokenManager;
    private app: express.Application;

    constructor() {
        this.tokenManager = new TokenManager();
        
        // Clear any existing token file on server startup
        console.log("🔄 Clearing any existing token cache on server startup...");
        this.tokenManager.clearToken(false); // Show message on startup
        
        this.server = new Server(
            {
                name: "RetrieveIntegrationInstances",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.app = express();
        this.app.use(cors());

        this.setupHandlers();

        this.server.onerror = (error) => console.error("[MCP Error]", error);
    }

    private async getAccessToken(forceRefresh: boolean = false): Promise<string> {
        // Check for cached token first (unless force refresh is requested)
        if (!forceRefresh) {
            const cachedToken = this.tokenManager.getToken();
            if (cachedToken) {
                const remainingTime = this.tokenManager.getTokenRemainingTime();
                if (remainingTime !== null) {
                    const minutes = Math.floor(remainingTime / 60);
                    const seconds = remainingTime % 60;
                    console.log(`✓ Using cached access token (${minutes}m ${seconds}s remaining until refresh)`);
                } else {
                    console.log("✓ Using cached access token");
                }
                return cachedToken;
            }
        }

        // No valid cached token found, fetch a new one
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');
            params.append('scope', CONFIG.scope);

            if (!CONFIG.clientId || !CONFIG.clientSecret || !CONFIG.tokenUrl) {
                throw new Error("OIC authentication credentials not configured. Please set OIC_CLIENT_ID, OIC_CLIENT_SECRET, and OIC_TOKEN_URL environment variables.");
            }

            console.log("🔄 Fetching new access token from OIC authentication server...");
            const auth = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');

            const response = await axios.post(CONFIG.tokenUrl, params, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const accessToken = response.data.access_token;
            // Use API's expires_in value or default to 3600 seconds (1 hour)
            const expiresIn = response.data.expires_in || 3600;

            console.log(`💾 Caching access token for ${expiresIn} seconds (${Math.round(expiresIn / 60)} minutes)`);
            this.tokenManager.saveToken(accessToken, expiresIn);

            return accessToken;
        } catch (error: any) {
            console.error("Failed to get access token:", error);
            if (error.response) {
                throw new Error(`Authentication failed: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                { 
                    name: "monitoringInstances", 
                    description: `Retrieve information about integration instances for the past hour (default) ordered by last updated time. Supports advanced filtering, pagination, and field selection. You can perform multi-word value searches using businessIDValue, primaryValue, secondaryValue, and tertiaryValue attributes. Supports filtering by status, time window, integration code, version, duration, dates, tracking variables, and more. Reference: https://docs.oracle.com/en/cloud/paas/application-integration/rest-api/op-ic-api-integration-v1-monitoring-instances-get.html`, 
                    inputSchema: monitoringInstancesSchema 
                },
                { 
                    name: "monitoringInstanceDetails", 
                    description: "Retrieve detailed information about a specific integration instance including status, tracking variables, audit trails, activity streams, and execution details.", 
                    inputSchema: monitoringInstanceDetailsSchema 
                },
                { 
                    name: "monitoringIntegrations", 
                    description: "Retrieve a list of integrations with optional filtering and pagination. Supports filtering by integration status (active/inactive) and other criteria.", 
                    inputSchema: monitoringIntegrationsSchema 
                },
                { 
                    name: "monitoringIntegrationDetails", 
                    description: "Retrieve detailed information about a specific integration including configuration, version, and metadata.", 
                    inputSchema: monitoringIntegrationDetailsSchema 
                },
                { 
                    name: "monitoringAgentGroups", 
                    description: "Retrieve a list of agent groups with optional filtering by name and sorting options.", 
                    inputSchema: monitoringAgentGroupsSchema 
                },
                { 
                    name: "monitoringAgentGroupDetails", 
                    description: "Retrieve detailed information about a specific agent group including configuration and metadata.", 
                    inputSchema: monitoringAgentGroupDetailsSchema 
                },
                { 
                    name: "monitoringAgentsInGroup", 
                    description: "Retrieve a list of agents belonging to a specific agent group.", 
                    inputSchema: monitoringAgentsInGroupSchema 
                },
                { 
                    name: "monitoringAuditRecords", 
                    description: "Retrieve audit records with optional filtering and pagination. Audit records provide a history of actions performed on integrations.", 
                    inputSchema: monitoringAuditRecordsSchema 
                },
                { 
                    name: "monitoringErrorRecoveryJobs", 
                    description: "Retrieve error recovery jobs that handle bulk resubmission of errored integration instances.", 
                    inputSchema: monitoringErrorRecoveryJobsSchema 
                },
                { 
                    name: "monitoringErroredInstances", 
                    description: "Retrieve integration instances that have encountered errors, with optional filtering and pagination.", 
                    inputSchema: monitoringErroredInstancesSchema 
                },
                { 
                    name: "monitoringScheduledRuns", 
                    description: "Retrieve scheduled integration runs with optional filtering and pagination. Applies to scheduled orchestrations.", 
                    inputSchema: monitoringScheduledRunsSchema 
                },
                { 
                    name: "monitoringActivityStream", 
                    description: "Retrieve the activity stream for a specific integration instance. Activity streams show the execution flow and steps performed during integration instance processing.", 
                    inputSchema: monitoringActivityStreamSchema 
                },
                { 
                    name: "monitoringLogs", 
                    description: "Retrieve log entries for a specific integration instance. Logs provide detailed execution information, errors, and debugging data.", 
                    inputSchema: monitoringLogsSchema 
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const token = await this.getAccessToken();
            const { name, arguments: args } = request.params;
            const params = args as any || {};

            // Add required integrationInstance parameter to all calls
            params.integrationInstance = CONFIG.integrationInstance;

            try {
                let endpoint = "";
                let results: any;
                let id = "";

                switch (name) {
                    case "monitoringInstances":
                        endpoint = "/instances";
                        if (!params.q && !params.limit && !params.offset) {
                            params.q = "{timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}";
                            params.orderBy = 'lastupdateddate';
                            params.fields = 'runId';
                        }
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringInstanceDetails":
                        id = params.id;
                        delete params.id; // Remove ID from params as it's in URL
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/instances/${id}`, token, params);
                        break;

                    case "monitoringIntegrations":
                        endpoint = "/integrations";
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringIntegrationDetails":
                        id = params.id;
                        delete params.id;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/integrations/${id}`, token, params);
                        break;

                    case "monitoringAgentGroups":
                        endpoint = "/agentgroups";
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringAgentGroupDetails":
                        id = params.id;
                        delete params.id;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/agentgroups/${id}`, token, params);
                        break;

                    case "monitoringAgentsInGroup":
                        id = params.id;
                        delete params.id;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/agentgroups/${id}/agents`, token, params);
                        break;

                    case "monitoringAuditRecords":
                        endpoint = "/auditRecords";
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringErrorRecoveryJobs":
                        endpoint = "/errorRecoveryJobs";
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringErroredInstances":
                        endpoint = "/erroredInstances";
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringScheduledRuns":
                        endpoint = "/scheduledruns";
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringActivityStream":
                        id = params.id;
                        delete params.id;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/instances/${id}/activitystream`, token, params);
                        break;

                    case "monitoringLogs":
                        id = params.id;
                        delete params.id;
                        // Logs might return binary or text, handling as text for now
                        try {
                            const logResponse = await axios.get(`${CONFIG.apiBaseUrl}/logs/${id}`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                                params: params,
                                responseType: 'text'
                            });
                            results = { logContent: logResponse.data };
                        } catch (error: any) {
                            // If we get a 401, refresh token and retry
                            if (error.response?.status === 401) {
                                console.log("Received 401, refreshing token and retrying...");
                                this.tokenManager.clearToken();
                                const newToken = await this.getAccessToken(true);
                                const logResponse = await axios.get(`${CONFIG.apiBaseUrl}/logs/${id}`, {
                                    headers: { 'Authorization': `Bearer ${newToken}` },
                                    params: params,
                                    responseType: 'text'
                                });
                                results = { logContent: logResponse.data };
                            } else {
                                throw error;
                            }
                        }
                        break;

                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            } catch (error: any) {
                let errorMessage = `Error executing ${name}: ${error.message}`;
                
                // Provide more detailed error information
                if (error.response) {
                    const status = error.response.status;
                    const statusText = error.response.statusText;
                    const data = error.response.data;
                    
                    if (status === 401) {
                        errorMessage = `Authentication failed (401): The access token may be invalid or expired. Please check your OIC credentials.`;
                    } else if (status === 403) {
                        errorMessage = `Authorization failed (403): You don't have permission to access this resource.`;
                    } else if (status === 404) {
                        errorMessage = `Resource not found (404): The requested endpoint does not exist.`;
                    } else {
                        errorMessage = `Error executing ${name}: ${status} ${statusText}${data ? ` - ${JSON.stringify(data)}` : ''}`;
                    }
                } else if (error.request) {
                    errorMessage = `Network error: Unable to reach the API server. Please check your network connection and API base URL.`;
                }
                
                console.error(`Error in ${name}:`, errorMessage);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: errorMessage,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async fetchSingle(url: string, token: string, params: any, retryOn401: boolean = true): Promise<any> {
        try {
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                params: params
            });
            return response.data;
        } catch (error: any) {
            // If we get a 401 and haven't retried yet, refresh token and retry
            if (error.response?.status === 401 && retryOn401) {
                console.log("Received 401, refreshing token and retrying...");
                this.tokenManager.clearToken();
                const newToken = await this.getAccessToken(true);
                return this.fetchSingle(url, newToken, params, false);
            }
            throw error;
        }
    }

    private async fetchWithPagination(url: string, token: string, initialParams: any, retryOn401: boolean = true) {
        let offset = initialParams.offset || 0;
        const limit = initialParams.limit || 50;
        let allItems: any[] = [];
        let totalRecords = -1;
        let currentToken = token;

        const params = { ...initialParams };
        params.limit = limit;

        while (totalRecords === -1 || offset < totalRecords) {
            params.offset = offset;

            try {
                const response = await axios.get<OicResponse>(url, {
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Accept': 'application/json'
                    },
                    params: params
                });

                const data = response.data;
                const items = data.items || [];
                allItems = allItems.concat(items);

                if (data.totalRecordsCount !== undefined) {
                    totalRecords = data.totalRecordsCount;
                } else {
                    if (items.length < limit) {
                        break;
                    }
                }

                offset += limit;

                if (offset > 10000) {
                    console.warn("Reached safety limit of 10000 records");
                    break;
                }
            } catch (error: any) {
                // If we get a 401 and haven't retried yet, refresh token and retry
                if (error.response?.status === 401 && retryOn401) {
                    console.log("Received 401, refreshing token and retrying...");
                    this.tokenManager.clearToken();
                    currentToken = await this.getAccessToken(true);
                    // Retry the same request with new token
                    continue;
                }
                throw error;
            }
        }

        return {
            totalRecords: totalRecords !== -1 ? totalRecords : allItems.length,
            retrievedRecords: allItems.length,
            items: allItems
        };
    }

    async run() {
        let transport: SSEServerTransport;

        // Health check endpoint for Cloud Run and Docker
        this.app.get("/health", (req, res) => {
            res.status(200).json({
                status: "healthy",
                service: "oic-monitor-mcp-server",
                version: "1.0.0",
                timestamp: new Date().toISOString()
            });
        });

        // Root endpoint
        this.app.get("/", (req, res) => {
            res.json({
                service: "OIC Monitor MCP Server",
                version: "1.0.0",
                endpoints: {
                    sse: "/sse",
                    health: "/health",
                    messages: "/messages"
                },
                tools: [
                    "monitoringInstances",
                    "monitoringInstanceDetails",
                    "monitoringIntegrations",
                    "monitoringIntegrationDetails",
                    "monitoringAgentGroups",
                    "monitoringAgentGroupDetails",
                    "monitoringAgentsInGroup",
                    "monitoringAuditRecords",
                    "monitoringErrorRecoveryJobs",
                    "monitoringErroredInstances",
                    "monitoringScheduledRuns",
                    "monitoringActivityStream",
                    "monitoringLogs"
                ]
            });
        });

        // SSE endpoint for MCP protocol
        this.app.get("/sse", async (req, res) => {
            transport = new SSEServerTransport("/messages", res);
            await this.server.connect(transport);
        });

        // Messages endpoint for MCP protocol
        this.app.post("/messages", async (req, res) => {
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(404).send("Session not found");
            }
        });

        const port = process.env.PORT || 3000;
        const server = this.app.listen(port, () => {
            console.log(`OIC Monitor MCP Server running on port ${port}`);
            console.log(`SSE Endpoint: http://localhost:${port}/sse`);
            console.log(`Health Check: http://localhost:${port}/health`);
        });

        // Setup graceful shutdown handlers to clear token on server stop
        let isShuttingDown = false;
        const shutdown = async (signal: string) => {
            if (isShuttingDown) {
                return; // Prevent multiple shutdown calls
            }
            isShuttingDown = true;
            
            console.log(`\n${signal} received. Shutting down gracefully...`);
            console.log("🔄 Clearing token cache on server shutdown...");
            this.tokenManager.clearToken(true); // Silent if no file exists (expected after startup deletion)
            
            server.close(() => {
                console.log("Server closed.");
                process.exit(0);
            });
            
            // Force exit after 5 seconds if server doesn't close
            setTimeout(() => {
                console.log("Forcing exit...");
                process.exit(1);
            }, 5000);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
}

const server = new OicMonitorServer();
server.run().catch(console.error);
