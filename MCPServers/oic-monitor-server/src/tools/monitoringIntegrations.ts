import { monitoringIntegrationsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/integrations";

export const monitoringIntegrationsTool: ToolDefinition = {
    name: "monitoringIntegrations",
    description: "Retrieve integration metadata with status information and runtime statistics.",
    schema: monitoringIntegrationsSchema,
    execute: async (context: ToolContext, params: any) => {
        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        return context.fetchWithPagination(
            `${context.defaultConfig.apiBaseUrl}${endpoint}`,
            token,
            requestParams
        );
    },
};

