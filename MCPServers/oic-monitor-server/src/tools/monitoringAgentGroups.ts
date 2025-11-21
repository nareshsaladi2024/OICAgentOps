import { monitoringAgentGroupsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/agentgroups";

export const monitoringAgentGroupsTool: ToolDefinition = {
    name: "monitoringAgentGroups",
    description: "List agent groups with status and connectivity information.",
    schema: monitoringAgentGroupsSchema,
    execute: async (context: ToolContext, params: any) => {
        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}${endpoint}`,
            token,
            requestParams
        );
    },
};

