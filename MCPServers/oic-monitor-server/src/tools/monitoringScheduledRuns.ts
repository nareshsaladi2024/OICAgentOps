import { monitoringScheduledRunsSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/futureruns";

export const monitoringScheduledRunsTool: ToolDefinition = {
    name: "monitoringScheduledRuns",
    description: "Retrieve upcoming scheduled integration runs and their execution metadata.",
    schema: monitoringScheduledRunsSchema,
    execute: async (context: ToolContext, params: any) => {
        if (!params.environment) {
            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
        }
        
        const environment = params.environment;
        const envConfig = getConfigForEnvironment(environment);
        const token = await context.getAccessToken(envConfig, false, environment);
        
        const requestParams = {
            ...params,
            limit: 50,
            offset: 0,
            integrationInstance: envConfig.integrationInstance,
        };
        
        delete requestParams.environment;

        return context.fetchWithPagination(
            `${envConfig.apiBaseUrl}${endpoint}`,
            token,
            requestParams,
            true,
            environment,
            envConfig
        );
    },
};

