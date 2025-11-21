import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express from "express";
import { randomUUID } from "node:crypto";

import cors from "cors";
import { CONFIG, getConfigForEnvironment } from "./config.js";
import { TokenManager } from "./tokenManager.js";
import * as Schemas from "./schemas.js";
import { OicResponse } from "./types.js";

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
                    inputSchema: Schemas.monitoringInstancesSchema 
                },
                { 
                    name: "monitoringInstanceDetails", 
                    description: "Retrieve detailed information about a specific integration instance including status, tracking variables, audit trails, activity streams, and execution details.", 
                    inputSchema: Schemas.monitoringInstanceDetailsSchema 
                },
                { 
                    name: "monitoringIntegrations", 
                    description: "Retrieve a list of integrations with optional filtering and pagination. Supports filtering by integration status (active/inactive) and other criteria.", 
                    inputSchema: Schemas.monitoringIntegrationsSchema 
                },
                { 
                    name: "monitoringIntegrationDetails", 
                    description: "Retrieve detailed information about a specific integration including configuration, version, and metadata.", 
                    inputSchema: Schemas.monitoringIntegrationDetailsSchema 
                },
                { 
                    name: "monitoringAgentGroups", 
                    description: "Retrieve a list of agent groups with optional filtering by name and sorting options.", 
                    inputSchema: Schemas.monitoringAgentGroupsSchema 
                },
                { 
                    name: "monitoringAgentGroupDetails", 
                    description: "Retrieve detailed information about a specific agent group including configuration and metadata.", 
                    inputSchema: Schemas.monitoringAgentGroupDetailsSchema 
                },
                { 
                    name: "monitoringAgentsInGroup", 
                    description: "Retrieve a list of agents belonging to a specific agent group.", 
                    inputSchema: Schemas.monitoringAgentsInGroupSchema 
                },
                { 
                    name: "monitoringAuditRecords", 
                    description: "Retrieve audit records with optional filtering and pagination. Audit records provide a history of actions performed on integrations.", 
                    inputSchema: Schemas.monitoringAuditRecordsSchema 
                },
                { 
                    name: "monitoringErrorRecoveryJobs", 
                    description: "Retrieve error recovery jobs that handle bulk resubmission of errored integration instances.", 
                    inputSchema: Schemas.monitoringErrorRecoveryJobsSchema 
                },
                { 
                    name: "monitoringErroredInstances", 
                    description: "Retrieve integration instances that have encountered errors, with optional filtering and pagination.", 
                    inputSchema: Schemas.monitoringErroredInstancesSchema 
                },
                { 
                    name: "monitoringScheduledRuns", 
                    description: "Retrieve scheduled integration runs with optional filtering and pagination. Applies to scheduled orchestrations.", 
                    inputSchema: Schemas.monitoringScheduledRunsSchema 
                },
                { 
                    name: "monitoringActivityStream", 
                    description: "Retrieve the activity stream for a specific integration instance. Activity streams show the execution flow and steps performed during integration instance processing.", 
                    inputSchema: Schemas.monitoringActivityStreamSchema 
                },
                { 
                    name: "monitoringLogs", 
                    description: "Retrieve log entries for a specific integration instance. Logs provide detailed execution information, errors, and debugging data.", 
                    inputSchema: Schemas.monitoringLogsSchema 
                },
                { 
                    name: "monitoringAbortInstance", 
                    description: "Abort a running integration instance. This operation stops the execution of an in-progress integration instance.", 
                    inputSchema: Schemas.monitoringAbortInstanceSchema 
                },
                { 
                    name: "monitoringDiscardErroredInstance", 
                    description: "Discard a single errored integration instance. This removes the errored instance from the error queue.", 
                    inputSchema: Schemas.monitoringDiscardErroredInstanceSchema 
                },
                { 
                    name: "monitoringDiscardErroredInstances", 
                    description: "Discard multiple errored integration instances based on filter criteria. This removes errored instances from the error queue.", 
                    inputSchema: Schemas.monitoringDiscardErroredInstancesSchema 
                },
                { 
                    name: "monitoringResubmitErroredInstance", 
                    description: "Resubmit a single errored integration instance for reprocessing.", 
                    inputSchema: Schemas.monitoringResubmitErroredInstanceSchema 
                },
                { 
                    name: "monitoringResubmitErroredInstances", 
                    description: "Resubmit multiple errored integration instances based on filter criteria for reprocessing.", 
                    inputSchema: Schemas.monitoringResubmitErroredInstancesSchema 
                },
                { 
                    name: "monitoringErrorRecoveryJobDetails", 
                    description: "Retrieve detailed information about a specific error recovery job including status and progress.", 
                    inputSchema: Schemas.monitoringErrorRecoveryJobDetailsSchema 
                },
                { 
                    name: "monitoringErroredInstanceDetails", 
                    description: "Retrieve detailed information about a specific errored integration instance including error details and context.", 
                    inputSchema: Schemas.monitoringErroredInstanceDetailsSchema 
                },
                { 
                    name: "monitoringHistory", 
                    description: "Retrieve historical tracking metrics for integration instances. Provides historical performance and execution data.", 
                    inputSchema: Schemas.monitoringHistorySchema 
                },
                { 
                    name: "monitoringActivityStreamDetails", 
                    description: "Retrieve detailed activity stream information for an integration instance. Use this to download large payloads from activity stream details.", 
                    inputSchema: Schemas.monitoringActivityStreamDetailsSchema 
                },
                { 
                    name: "monitoringMessageCountSummary", 
                    description: "Retrieve message count summary for integrations. Provides aggregated message statistics across integrations.", 
                    inputSchema: Schemas.monitoringMessageCountSummarySchema 
                },
                { 
                    name: "monitoringAgentDetails", 
                    description: "Retrieve detailed status information for a specific agent within an agent group.", 
                    inputSchema: Schemas.monitoringAgentDetailsSchema 
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
                        
                        // Use full API path from Oracle API documentation
                        // https://docs.oracle.com/en/cloud/paas/application-integration/rest-api/api-integrations-monitoring.html
                        endpoint = "/ic/api/integration/v1/monitoring/instances";
                        
                        // Set fixed values as per requirements
                        params.fields = 'detail'; // Set to 'detail' before API call
                        params.orderBy = 'lastupdateddate'; // Set to lastupdateddate
                        params.limit = 50; // Set to 50 on API call
                        params.offset = 0; // Set to 0 on API call
                        params.groupBy = 'integration'; // Always group by integration
                        
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
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/instances/{id}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}`, token, params);
                        break;

                    case "monitoringIntegrations":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/integrations
                        endpoint = "/ic/api/integration/v1/monitoring/integrations";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringIntegrationDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/integrations/{id}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/integrations/${id}`, token, params);
                        break;

                    case "monitoringAgentGroups":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/agentgroups
                        endpoint = "/ic/api/integration/v1/monitoring/agentgroups";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringAgentGroupDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/agentgroups/{id}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}`, token, params);
                        break;

                    case "monitoringAgentsInGroup":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/agentgroups/{id}/agents
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}/agents`, token, params);
                        break;

                    case "monitoringAuditRecords":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/auditRecords
                        endpoint = "/ic/api/integration/v1/monitoring/auditRecords";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringErrorRecoveryJobs":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/errors/recoveryJobs
                        endpoint = "/ic/api/integration/v1/monitoring/errors/recoveryJobs";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringErroredInstances":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/errors
                        endpoint = "/ic/api/integration/v1/monitoring/errors";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringScheduledRuns":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/futureruns
                        endpoint = "/ic/api/integration/v1/monitoring/futureruns";
                        params.integrationInstance = CONFIG.integrationInstance;
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringActivityStream":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: /ic/api/integration/v1/monitoring/instances/{id}/activityStream
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/activityStream`, token, params);
                        break;

                    case "monitoringLogs":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Note: Logs endpoint path not found in Oracle API monitoring docs
                        // Using standard pattern: /ic/api/integration/v1/monitoring/instances/{id}/logs
                        // Logs might return binary or text, handling as text for now
                        try {
                            const logResponse = await axios.get(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/logs`, {
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
                                const logResponse = await axios.get(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/logs`, {
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

                    case "monitoringAbortInstance":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: POST /ic/api/integration/v1/monitoring/instances/{id}/abort
                        const abortResponse = await axios.post(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/abort`, null, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            params: params
                        });
                        results = abortResponse.data;
                        break;

                    case "monitoringDiscardErroredInstance":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: POST /ic/api/integration/v1/monitoring/errors/{id}/discard
                        const discardResponse = await axios.post(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${id}/discard`, null, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            params: params
                        });
                        results = discardResponse.data;
                        break;

                    case "monitoringDiscardErroredInstances":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: POST /ic/api/integration/v1/monitoring/errors/discard
                        const discardAllResponse = await axios.post(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/discard`, null, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            params: params
                        });
                        results = discardAllResponse.data;
                        break;

                    case "monitoringResubmitErroredInstance":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: POST /ic/api/integration/v1/monitoring/errors/{id}/resubmit
                        const resubmitResponse = await axios.post(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${id}/resubmit`, null, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            params: params
                        });
                        results = resubmitResponse.data;
                        break;

                    case "monitoringResubmitErroredInstances":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: POST /ic/api/integration/v1/monitoring/errors/resubmit
                        const resubmitAllResponse = await axios.post(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/resubmit`, null, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            params: params
                        });
                        results = resubmitAllResponse.data;
                        break;

                    case "monitoringErrorRecoveryJobDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: GET /ic/api/integration/v1/monitoring/errors/recoveryJobs/{id}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/recoveryJobs/${id}`, token, params);
                        break;

                    case "monitoringErroredInstanceDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        delete params.id;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: GET /ic/api/integration/v1/monitoring/errors/{id}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${id}`, token, params);
                        break;

                    case "monitoringHistory":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: GET /ic/api/integration/v1/monitoring/history
                        endpoint = "/ic/api/integration/v1/monitoring/history";
                        results = await this.fetchWithPagination(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringActivityStreamDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        const key = params.key;
                        delete params.id;
                        delete params.key;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: GET /ic/api/integration/v1/monitoring/instances/{id}/activityStreamDetails/{+key}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/activityStreamDetails/${key}`, token, params);
                        break;

                    case "monitoringMessageCountSummary":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: GET /ic/api/integration/v1/monitoring/integrations/messages/summary
                        endpoint = "/ic/api/integration/v1/monitoring/integrations/messages/summary";
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}${endpoint}`, token, params);
                        break;

                    case "monitoringAgentDetails":
                        token = await this.getAccessToken(CONFIG, false, 'dev');
                        id = params.id;
                        const agentKey = params.key;
                        delete params.id;
                        delete params.key;
                        params.integrationInstance = CONFIG.integrationInstance;
                        // Path from Oracle API docs: GET /ic/api/integration/v1/monitoring/agentgroups/{id}/agents/{key}
                        results = await this.fetchSingle(`${CONFIG.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}/agents/${agentKey}`, token, params);
                        break;

                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }

                // For paginated results, ensure items array is included
                // fetchWithPagination returns {totalRecords, retrievedRecords, items}
                // fetchSingle returns the raw API response
                let responseData = results;
                
                // If results has items property (from fetchWithPagination), return it directly
                // Otherwise, wrap single results in the expected format
                if (results && results.items !== undefined) {
                    // Paginated response - return as-is with items array
                    responseData = results;
                } else if (results && Array.isArray(results)) {
                    // Array response - wrap in items
                    responseData = { items: results };
                } else if (results && results.items === undefined) {
                    // Single object response - keep as-is
                    responseData = results;
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(responseData, null, 2),
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
        const limit = initialParams.limit || 50;
        let allItems: any[] = [];
        let totalRecords = -1;
        let currentToken = token;
        const MAX_OFFSET = 500; // Oracle API maximum offset limit
        let lastRecordDate: string | null = null;
        let batchNumber = 0;

        // Parse existing q parameter if present
        let baseQuery = initialParams.q || '';
        let hasMoreRecords = true;

        while (hasMoreRecords) {
            // Reset offset to 0 for each batch
            let offset = 0;
            const params = { ...initialParams };
            params.limit = limit;
            params.offset = offset;

            // If we have a last record date, modify the query to filter by startdate
            if (lastRecordDate) {
                // Parse existing q parameter and add/modify startdate filter
                // Format: {timewindow:'1h', status:'IN_PROGRESS', ...}
                // We'll add startdate filter to get records after the last one
                if (baseQuery) {
                    // Remove existing startdate if present and add new one
                    baseQuery = baseQuery.replace(/startdate:[^,}]+/g, '');
                    // Add startdate filter (remove trailing comma if needed)
                    baseQuery = baseQuery.replace(/\}$/, `, startdate:'${lastRecordDate}'}`);
                } else {
                    baseQuery = `{startdate:'${lastRecordDate}'}`;
                }
                params.q = baseQuery;
            }

            let batchItems: any[] = [];
            let batchTotalRecords = -1;

            // Fetch records in this batch (offset 0 to 500)
            while (offset <= MAX_OFFSET) {
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
                    batchItems = batchItems.concat(items);

                    if (data.totalRecordsCount !== undefined) {
                        batchTotalRecords = data.totalRecordsCount;
                        if (totalRecords === -1) {
                            totalRecords = data.totalRecordsCount;
                        }
                    }

                    // If we got fewer items than the limit, we've reached the end of this batch
                    if (items.length < limit) {
                        break;
                    }

                    offset += limit;

                    // Stop if next offset would exceed maximum
                    if (offset > MAX_OFFSET) {
                        break;
                    }
                } catch (error: any) {
                    // If we get a 401 and haven't retried yet, refresh token and retry
                    if (error.response?.status === 401 && retryOn401) {
                        console.log("Received 401, refreshing token and retrying...");
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

            // Add batch items to all items
            allItems = allItems.concat(batchItems);
            batchNumber++;

            // If we got no items or fewer than limit, we're done
            if (batchItems.length === 0 || batchItems.length < limit) {
                hasMoreRecords = false;
                break;
            }

            // Get the last record's date to use as filter for next batch
            const lastItem = batchItems[batchItems.length - 1];
            const lastDate = lastItem['creation-date'] || lastItem['creationDate'] || lastItem['last-tracked-time'] || lastItem['lastTrackedTime'] || lastItem['date'];
            
            if (lastDate) {
                lastRecordDate = lastDate;
                console.log(`Batch ${batchNumber}: Retrieved ${batchItems.length} records. Total so far: ${allItems.length}. Using last record date: ${lastRecordDate} for next batch.`);
            } else {
                // If we can't get a date from the last record, we can't continue pagination
                console.warn(`Batch ${batchNumber}: Could not determine last record date. Stopping pagination.`);
                hasMoreRecords = false;
                break;
            }

            // Safety check: prevent infinite loops
            if (batchNumber > 100) {
                console.warn("Reached safety limit of 100 batches. Stopping pagination.");
                break;
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
