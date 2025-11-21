import { monitoringAgentDetailsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringAgentDetailsTool: ToolDefinition = {
    name: "monitoringAgentDetails",
    description: "Retrieve status information for a specific agent within an agent group.",
    schema: monitoringAgentDetailsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        const key = params.key;

        if (!id) {
            throw new Error("Agent group id (id) is required");
        }
        if (!key) {
            throw new Error("Agent key (key) is required");
        }

        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;
        delete requestParams.key;

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}/agents/${key}`,
            token,
            requestParams
        );
    },
};

