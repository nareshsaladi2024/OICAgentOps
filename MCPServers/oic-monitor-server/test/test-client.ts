import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";

// Polyfill EventSource for Node.js
global.EventSource = EventSource as any;

async function main() {
    console.log("Connecting to server via SSE...");

    const transport = new SSEClientTransport(
        new URL("http://localhost:3000/sse")
    );

    const client = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);
        console.log("Connected to server");

        const tools = await client.listTools();
        console.log("Available tools:", tools.tools.map(t => t.name));

        // Test 1: Monitoring Integrations (using limit from Postman data)
        console.log("\n--- Testing monitoringIntegrations ---");
        const integrationsResult = await client.callTool({
            name: "monitoringIntegrations",
            arguments: {
                limit: 16, // Using limit from Postman collection
                offset: 0
            }
        });
        console.log("Result Summary:", JSON.stringify(integrationsResult).substring(0, 200) + "...");

        // Test 2: Monitoring Instances
        console.log("\n--- Testing monitoringInstances ---");
        const instancesResult = await client.callTool({
            name: "monitoringInstances",
            arguments: {
                limit: 5,
                q: "{timewindow:'1h', status:'IN_PROGRESS'}"
            }
        });
        console.log("Result Summary:", JSON.stringify(instancesResult).substring(0, 200) + "...");

        // Test 3: Monitoring Agent Groups
        console.log("\n--- Testing monitoringAgentGroups ---");
        const agentGroupsResult = await client.callTool({
            name: "monitoringAgentGroups",
            arguments: {}
        });
        console.log("Result Summary:", JSON.stringify(agentGroupsResult).substring(0, 200) + "...");

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
