#!/usr/bin/env node
/**
 * Test client for OIC Monitor MCP Server using Streamable HTTP transport
 * 
 * This script tests the streamable HTTP endpoint:
 * https://oic-monitor-server-1276251306.us-central1.run.app/stream
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SERVER_URL = "https://oic-monitor-server-1276251306.us-central1.run.app/stream";

async function testStreamableHTTP() {
    console.log("========================================");
    console.log("Testing OIC Monitor MCP Server");
    console.log("Transport: Streamable HTTP");
    console.log("URL:", SERVER_URL);
    console.log("========================================\n");

    const client = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    // Create streamable HTTP transport
    // StreamableHTTPClientTransport expects a URL object
    const transport = new StreamableHTTPClientTransport(
        new URL(SERVER_URL)
    );

    try {
        console.log("Connecting to server...");
        await client.connect(transport);
        console.log("✓ Connected successfully\n");

        // Test 1: List available tools
        console.log("Test 1: Listing available tools...");
        const toolsResponse = await client.listTools();
        console.log(`✓ Found ${toolsResponse.tools.length} tools:`);
        toolsResponse.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name} - ${tool.description}`);
        });
        console.log("");

        // Test 2: Call a simple tool (monitoringAgentGroups - no required params)
        const agentGroupsTool = toolsResponse.tools.find(t => t.name === "monitoringAgentGroups");
        if (agentGroupsTool) {
            console.log(`Test 2: Calling tool '${agentGroupsTool.name}'...`);
            
            try {
                // monitoringAgentGroups doesn't require any parameters
                const result = await client.callTool({
                    name: agentGroupsTool.name,
                    arguments: {},
                });

                console.log(`✓ Tool call successful`);
                console.log("Result:");
                if (result.content && result.content.length > 0) {
                    const content = result.content[0];
                    if (content.type === "text") {
                        try {
                            const parsed = JSON.parse(content.text);
                            console.log(JSON.stringify(parsed, null, 2));
                        } catch {
                            console.log(content.text);
                        }
                    } else {
                        console.log(JSON.stringify(content, null, 2));
                    }
                } else {
                    console.log("(No content returned)");
                }
            } catch (toolError: any) {
                console.error(`✗ Tool call failed:`, toolError.message);
                if (toolError.stack) {
                    console.error(toolError.stack);
                }
            }
        }

        console.log("\n========================================");
        console.log("Test completed successfully!");
        console.log("========================================");

    } catch (error: any) {
        console.error("\n✗ Connection or test failed:");
        console.error("Error:", error.message);
        if (error.stack) {
            console.error("Stack:", error.stack);
        }
        process.exit(1);
    } finally {
        // Close the connection
        try {
            await client.close();
            console.log("\n✓ Connection closed");
        } catch (closeError) {
            console.error("Error closing connection:", closeError);
        }
    }
}

// Run the test
testStreamableHTTP().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});

