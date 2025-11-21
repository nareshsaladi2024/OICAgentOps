import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
import express from "express";
import { randomUUID } from "node:crypto";

import cors from "cors";
import { CONFIG, getConfigForEnvironment } from "./config.js";
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
        },
        groupBy: { 
            type: "string", 
            description: "Groups results by integration name. Optional. Valid value: 'integration'",
            enum: ["integration"],
            default: ""
        }
    },
    required: ["duration", "status", "environment"]
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
    private tokenManagers: Map<string, TokenManager>;
    private app: express.Application;

    constructor() {
        // Use a map to store token managers per environment
        this.tokenManagers = new Map();
        
        // Initialize token managers for each environment
        const environments = ['dev', 'qa3', 'prod1', 'prod3'];
        environments.forEach(env => {
            this.tokenManagers.set(env, new TokenManager());
        });
        
        // Clear any existing token files on server startup
        console.log("🔄 Clearing any existing token cache on server startup...");
        this.tokenManagers.forEach((tokenManager) => {
            tokenManager.clearToken(false); // Show message on startup
        });
        
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

    private async getAccessToken(envConfig: any, forceRefresh: boolean = false, environment?: string): Promise<string> {
        const env = environment || 'dev';
        const tokenManager = this.tokenManagers.get(env) || this.tokenManagers.get('dev')!;
        
        // Check for cached token first (unless force refresh is requested)
        if (!forceRefresh) {
            const cachedToken = tokenManager.getToken();
            if (cachedToken) {
                const remainingTime = tokenManager.getTokenRemainingTime();
                if (remainingTime !== null) {
                    const minutes = Math.floor(remainingTime / 60);
                    const seconds = remainingTime % 60;
                    console.log(`✓ Using cached access token for ${env} (${minutes}m ${seconds}s remaining until refresh)`);
                } else {
                    console.log(`✓ Using cached access token for ${env}`);
                }
                return cachedToken;
            }
        }

        // No valid cached token found, fetch a new one
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');
            params.append('scope', envConfig.scope);

            if (!envConfig.clientId || !envConfig.clientSecret || !envConfig.tokenUrl) {
                throw new Error(`OIC authentication credentials not configured for environment ${env}. Please set OIC_CLIENT_ID, OIC_CLIENT_SECRET, and OIC_TOKEN_URL in .env.${env} file.`);
            }

            console.log(`🔄 Fetching new access token from OIC authentication server for ${env}...`);
            const auth = Buffer.from(`${envConfig.clientId}:${envConfig.clientSecret}`).toString('base64');

            const response = await axios.post(envConfig.tokenUrl, params, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const accessToken = response.data.access_token;
            // Use API's expires_in value or default to 3600 seconds (1 hour)
            const expiresIn = response.data.expires_in || 3600;

            console.log(`💾 Caching access token for ${env} for ${expiresIn} seconds (${Math.round(expiresIn / 60)} minutes)`);
            tokenManager.saveToken(accessToken, expiresIn);

            return accessToken;
        } catch (error: any) {
            console.error(`Failed to get access token for ${env}:`, error);
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
                    description: "OIC Factory API to retrieve monitor instances for a given duration, status, environment", 
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
            const { name, arguments: args } = request.params;
            const params = args as any || {};

            try {
                let endpoint = "";
                let results: any;
                let id = "";
                let envConfig = CONFIG;
                let token = "";

                switch (name) {
                    case "monitoringInstances":
                        // Validate required parameters
                        if (!params.environment) {
                            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
                        }
                        if (!params.duration) {
                            throw new Error("Duration parameter is required. Valid values: '1h', '6h', '1d', '2d', '3d', 'RETENTIONPERIOD'");
                        }
                        if (!params.status) {
                            throw new Error("Status parameter is required. Valid values: 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABORTED'");
                        }
                        
                        const environment = params.environment;
                        envConfig = getConfigForEnvironment(environment);
                        
                        // Get access token for the specified environment
                        token = await this.getAccessToken(envConfig, false, environment);
                        
                        endpoint = "/instances";
                        
                        // Set fixed values as per requirements
                        params.fields = 'all'; // Set to 'all' (detail) before API call
                        params.orderBy = 'lastupdateddate'; // Set to lastupdateddate
                        params.limit = 50; // Set to 50 on API call
                        params.offset = 0; // Set to 0 on API call
                        
                        // Build q parameter from duration and status (both are required)
                        const duration = params.duration;
                        const status = params.status;
                        params.q = `{timewindow:'${duration}', status:'${status}', integration-style:'appdriven', includePurged:'yes'}`;
                        
                        // Remove duration, status, environment from params (they're now in q)
                        delete params.duration;
                        delete params.status;
                        delete params.environment;
                        
                        // Add required integrationInstance parameter from environment-specific config
                        // Note: integrationInstance is NOT a tool parameter - it's automatically
                        // read from the environment config (e.g., OIC_INTEGRATION_INSTANCE_DEV)
                        // based on the 'environment' parameter
                        params.integrationInstance = envConfig.integrationInstance;
                        
                        results = await this.fetchWithPagination(`${envConfig.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringInstanceDetails":
                        // Use default config for other tools (or could add environment param later)
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id; // Remove ID from params as it's in URL
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/instances/${id}`, token, params);
                        break;

                    case "monitoringIntegrations":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        endpoint = "/integrations";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringIntegrationDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/integrations/${id}`, token, params);
                        break;

                    case "monitoringAgentGroups":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        endpoint = "/agentgroups";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringAgentGroupDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/agentgroups/${id}`, token, params);
                        break;

                    case "monitoringAgentsInGroup":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/agentgroups/${id}/agents`, token, params);
                        break;

                    case "monitoringAuditRecords":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        endpoint = "/auditRecords";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringErrorRecoveryJobs":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        endpoint = "/errorRecoveryJobs";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringErroredInstances":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        endpoint = "/erroredInstances";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringScheduledRuns":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        endpoint = "/scheduledruns";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringActivityStream":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/instances/${id}/activitystream`, token, params);
                        break;

                    case "monitoringLogs":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
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
                                const env = 'dev'; // Default environment for other tools
                                const tokenManager = this.tokenManagers.get(env) || this.tokenManagers.get('dev')!;
                                tokenManager.clearToken();
                                const newToken = await this.getAccessToken(CONFIG, true, 'dev');
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
                // Note: This assumes default config, may need to pass envConfig for proper environment handling
                const env = 'dev';
                const tokenManager = this.tokenManagers.get(env) || this.tokenManagers.get('dev')!;
                tokenManager.clearToken();
                const newToken = await this.getAccessToken(CONFIG, true, 'dev');
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
                // Note: This assumes default config, may need to pass envConfig for proper environment handling
                const env = 'dev';
                const tokenManager = this.tokenManagers.get(env) || this.tokenManagers.get('dev')!;
                tokenManager.clearToken();
                currentToken = await this.getAccessToken(CONFIG, true, 'dev');
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
        let sseTransport: SSEServerTransport;
        let streamableHttpTransport: StreamableHTTPServerTransport;

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
                transports: {
                    sse: {
                        description: "Server-Sent Events transport (unidirectional, requires separate POST endpoint)",
                        endpoints: {
                            connect: "GET /sse",
                            messages: "POST /messages"
                        }
                    },
                    streamableHttp: {
                        description: "Streamable HTTP transport (bidirectional, single endpoint)",
                        endpoints: {
                            connect: "GET /stream",
                            messages: "POST /stream",
                            delete: "DELETE /stream"
                        }
                    }
                },
                endpoints: {
                    sse: "/sse",
                    stream: "/stream",
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

        // ============================================
        // SSE Transport (Legacy/Original)
        // ============================================
        // GET /sse - Establish SSE connection
        this.app.get("/sse", async (req, res) => {
            sseTransport = new SSEServerTransport("/messages", res);
            await this.server.connect(sseTransport);
        });

        // POST /messages - Client-to-server messages for SSE transport
        this.app.post("/messages", async (req, res) => {
            if (sseTransport) {
                await sseTransport.handlePostMessage(req, res);
            } else {
                res.status(404).send("SSE session not found. Connect to /sse first.");
            }
        });

        // ============================================
        // Streamable HTTP Transport (New)
        // ============================================
        // Create Streamable HTTP transport (stateful mode with session management)
        streamableHttpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => {
                // Generate a secure session ID
                return randomUUID();
            },
            enableJsonResponse: false, // Use SSE streaming by default
            onsessioninitialized: (sessionId: string) => {
                console.log(`[StreamableHTTP] Session initialized: ${sessionId}`);
            },
            onsessionclosed: (sessionId: string) => {
                console.log(`[StreamableHTTP] Session closed: ${sessionId}`);
            }
        });

        // Connect server to Streamable HTTP transport
        // Note: connect() will automatically start the transport, so we don't call start() explicitly
        await this.server.connect(streamableHttpTransport);

        // Handle all HTTP methods for Streamable HTTP transport
        // GET /stream - Establish SSE stream (for server-to-client messages)
        // POST /stream - Send client-to-server messages
        // DELETE /stream - Close session
        this.app.all("/stream", async (req, res) => {
            // Parse request body if it's a POST request
            let parsedBody = undefined;
            if (req.method === 'POST' && req.body) {
                parsedBody = req.body;
            }

            await streamableHttpTransport.handleRequest(req, res, parsedBody);
        });

        const port = process.env.PORT || 3000;
        const server = this.app.listen(port, () => {
            console.log(`OIC Monitor MCP Server running on port ${port}`);
            console.log(``);
            console.log(`Transport Endpoints:`);
            console.log(`  SSE Transport:`);
            console.log(`    Connect: GET  http://localhost:${port}/sse`);
            console.log(`    Messages: POST http://localhost:${port}/messages`);
            console.log(`  Streamable HTTP Transport:`);
            console.log(`    Connect: GET  http://localhost:${port}/stream`);
            console.log(`    Messages: POST http://localhost:${port}/stream`);
            console.log(`    Close: DELETE http://localhost:${port}/stream`);
            console.log(``);
            console.log(`Other Endpoints:`);
            console.log(`  Health: GET http://localhost:${port}/health`);
            console.log(`  Info: GET http://localhost:${port}/`);
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
            this.tokenManagers.forEach((tokenManager) => {
                tokenManager.clearToken(true); // Silent if no file exists (expected after startup deletion)
            });
            
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
