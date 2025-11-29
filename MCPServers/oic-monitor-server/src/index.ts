import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express from "express";
import { randomUUID } from "node:crypto";

import cors from "cors";
import { CONFIG } from "./config.js";
import { TokenManager } from "./tokenManager.js";
import { toolDefinitions, getToolByName } from "./tools/index.js";
import { ToolContext } from "./tools/types.js";
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
            tools: toolDefinitions.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.schema,
            })),
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const params = args as any || {};

            const tool = getToolByName(name);
            if (!tool) {
                throw new Error(`Unknown tool: ${name}`);
            }

            const context: ToolContext = {
                defaultConfig: CONFIG,
                getAccessToken: this.getAccessToken.bind(this),
                fetchWithPagination: this.fetchWithPagination.bind(this),
                fetchSingle: this.fetchSingle.bind(this),
            };

            try {
                const results = await tool.execute(context, params);

                let responseData = results;
                if (results && results.items !== undefined) {
                    responseData = results;
                } else if (results && Array.isArray(results)) {
                    responseData = { items: results };
                } else if (results && results.items === undefined) {
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
                    console.log(`[Pagination] Fetching: ${url} with params:`, JSON.stringify(params, null, 2));
                    const response = await axios.get<OicResponse>(url, {
                        headers: {
                            'Authorization': `Bearer ${currentToken}`,
                            'Accept': 'application/json'
                        },
                        params: params
                    });

                    const data = response.data;
                    console.log(`[Pagination] Response: totalRecordsCount=${data.totalRecordsCount}, items.length=${data.items?.length || 0}`);
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
        console.log("Connecting to StreamableHTTP transport...");
        await this.server.connect(streamableHttpTransport);
        // Explicitly start the transport if connect didn't do it (workaround)
        try {
            // @ts-ignore - start might be protected or not in type definition depending on SDK version
            if (streamableHttpTransport.start) {
                console.log("Explicitly starting StreamableHTTP transport...");
                await streamableHttpTransport.start();
                console.log("Explicitly started StreamableHTTP transport.");
            }
        } catch (e) {
            console.log("Error starting transport (might be already started):", e);
        }
        console.log("Connected to StreamableHTTP transport.");

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
