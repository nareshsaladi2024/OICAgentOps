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
    q: { type: "string", description: "Filter parameters." },
    orderBy: { type: "string", description: "Sort order." },
    limit: { type: "number", description: "Maximum number of items to return." },
    offset: { type: "number", description: "Starting point for pagination." }
};

const monitoringInstancesSchema = {
    type: "object",
    properties: {
        ...commonListSchema,
        fields: { type: "string", description: "Limit query results to a few fields. Valid values: runId, id, all." },
        groupBy: { type: "string", description: "Groups results by integration name. Valid values: integration." }
    },
};

const monitoringInstanceDetailsSchema = {
    type: "object",
    properties: {
        id: { type: "string", description: "The ID of the integration instance." }
    },
    required: ["id"]
};

const monitoringIntegrationsSchema = {
    type: "object",
    properties: {
        ...commonListSchema,
        return: { type: "string", description: "Type of records to return." }
    },
};

const monitoringIntegrationDetailsSchema = {
    type: "object",
    properties: {
        id: { type: "string", description: "The ID of the integration." }
    },
    required: ["id"]
};

const monitoringAgentGroupsSchema = {
    type: "object",
    properties: {
        q: { type: "string", description: "Filters results by agent group name." },
        orderBy: { type: "string", description: "Orders results by name or last updated time." }
    },
};

const monitoringAgentGroupDetailsSchema = {
    type: "object",
    properties: {
        id: { type: "string", description: "The ID of the agent group." }
    },
    required: ["id"]
};

const monitoringAgentsInGroupSchema = {
    type: "object",
    properties: {
        id: { type: "string", description: "The ID of the agent group." }
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
        id: { type: "string", description: "The ID of the integration instance." }
    },
    required: ["id"]
};

const monitoringLogsSchema = {
    type: "object",
    properties: {
        id: { type: "string", description: "The ID of the integration instance." }
    },
    required: ["id"]
};

class OicMonitorServer {
    private server: Server;
    private tokenManager: TokenManager;
    private app: express.Application;

    constructor() {
        this.tokenManager = new TokenManager();
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
        if (!forceRefresh) {
            const cachedToken = this.tokenManager.getToken();
            if (cachedToken) {
                const remainingTime = this.tokenManager.getTokenRemainingTime();
                if (remainingTime !== null) {
                    const minutes = Math.floor(remainingTime / 60);
                    const seconds = remainingTime % 60;
                    console.log(`Using cached access token (${minutes}m ${seconds}s remaining)`);
                } else {
                    console.log("Using cached access token");
                }
                return cachedToken;
            }
        }

        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');
            params.append('scope', CONFIG.scope);

            if (!CONFIG.clientId || !CONFIG.clientSecret || !CONFIG.tokenUrl) {
                throw new Error("OIC authentication credentials not configured. Please set OIC_CLIENT_ID, OIC_CLIENT_SECRET, and OIC_TOKEN_URL environment variables.");
            }

            console.log("Fetching new access token from OIC authentication server...");
            const auth = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');

            const response = await axios.post(CONFIG.tokenUrl, params, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const accessToken = response.data.access_token;
            const expiresIn = response.data.expires_in || 3600;

            console.log(`Caching access token for ${expiresIn} seconds (${Math.round(expiresIn / 60)} minutes)`);
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
                { name: "monitoringInstances", description: "Retrieve Integration Instances", inputSchema: monitoringInstancesSchema },
                { name: "monitoringInstanceDetails", description: "Retrieve Integration Instance Details", inputSchema: monitoringInstanceDetailsSchema },
                { name: "monitoringIntegrations", description: "Retrieve Integrations", inputSchema: monitoringIntegrationsSchema },
                { name: "monitoringIntegrationDetails", description: "Retrieve Integration Details", inputSchema: monitoringIntegrationDetailsSchema },
                { name: "monitoringAgentGroups", description: "Retrieve Agent Groups", inputSchema: monitoringAgentGroupsSchema },
                { name: "monitoringAgentGroupDetails", description: "Retrieve Agent Group Details", inputSchema: monitoringAgentGroupDetailsSchema },
                { name: "monitoringAgentsInGroup", description: "Retrieve Agents in Group", inputSchema: monitoringAgentsInGroupSchema },
                { name: "monitoringAuditRecords", description: "Retrieve Audit Records", inputSchema: monitoringAuditRecordsSchema },
                { name: "monitoringErrorRecoveryJobs", description: "Retrieve Error Recovery Jobs", inputSchema: monitoringErrorRecoveryJobsSchema },
                { name: "monitoringErroredInstances", description: "Retrieve Errored Instances", inputSchema: monitoringErroredInstancesSchema },
                { name: "monitoringScheduledRuns", description: "Retrieve Scheduled Runs", inputSchema: monitoringScheduledRunsSchema },
                { name: "monitoringActivityStream", description: "Retrieve Activity Stream", inputSchema: monitoringActivityStreamSchema },
                { name: "monitoringLogs", description: "Retrieve Logs", inputSchema: monitoringLogsSchema },
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

        this.app.get("/sse", async (req, res) => {
            transport = new SSEServerTransport("/messages", res);
            await this.server.connect(transport);
        });

        this.app.post("/messages", async (req, res) => {
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(404).send("Session not found");
            }
        });

        const port = process.env.PORT || 3000;
        this.app.listen(port, () => {
            console.log(`RetrieveIntegrationInstances Server running on port ${port}`);
            console.log(`SSE Endpoint: http://localhost:${port}/sse`);
        });
    }
}

const server = new OicMonitorServer();
server.run().catch(console.error);
