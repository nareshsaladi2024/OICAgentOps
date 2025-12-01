import { monitoringInstanceDetailsSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
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
        if (!params.environment) {
            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
        }

        const environment = params.environment;
        const envConfig = getConfigForEnvironment(environment);
        const token = await context.getAccessToken(envConfig, false, environment);
        
        const requestParams = {
            ...params,
            integrationInstance: envConfig.integrationInstance,
        };
        delete requestParams.id;
        delete requestParams.environment;

        return context.fetchSingle(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}`,
            token,
            requestParams,
            true,
            environment,
            envConfig
        );
    },
};

