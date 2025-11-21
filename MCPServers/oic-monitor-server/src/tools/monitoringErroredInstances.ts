import { monitoringErroredInstancesSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/errors";

export const monitoringErroredInstancesTool: ToolDefinition = {
    name: "monitoringErroredInstances",
    description: "Retrieve paginated list of errored integration instances with filtering support.",
    schema: monitoringErroredInstancesSchema,
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

