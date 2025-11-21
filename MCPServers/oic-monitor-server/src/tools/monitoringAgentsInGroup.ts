import { monitoringAgentsInGroupSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringAgentsInGroupTool: ToolDefinition = {
    name: "monitoringAgentsInGroup",
    description: "List all agents within a specific agent group.",
    schema: monitoringAgentsInGroupSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        if (!id) {
            throw new Error("Agent group id (id) is required");
        }

        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}/agents`,
            token,
            requestParams
        );
    },
};

