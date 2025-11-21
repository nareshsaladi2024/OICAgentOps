import { monitoringInstanceDetailsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringInstanceDetailsTool: ToolDefinition = {
    name: "monitoringInstanceDetails",
    description: "Retrieve detailed information for a specific integration instance by instanceId.",
    schema: monitoringInstanceDetailsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        if (!id) {
            throw new Error("Instance id (id) is required");
        }

        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}`,
            token,
            requestParams
        );
    },
};

