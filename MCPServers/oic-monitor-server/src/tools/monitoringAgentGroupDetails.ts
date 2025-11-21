import { monitoringAgentGroupDetailsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringAgentGroupDetailsTool: ToolDefinition = {
    name: "monitoringAgentGroupDetails",
    description: "Retrieve detail for a specific agent group including status and metadata.",
    schema: monitoringAgentGroupDetailsSchema,
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
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}`,
            token,
            requestParams
        );
    },
};

