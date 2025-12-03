import { monitoringErroredInstancesSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/errors";

export const monitoringErroredInstancesTool: ToolDefinition = {
    name: "monitoringErroredInstances",
    description: "Retrieve errored integration instances filtered by duration and environment. Returns counts and detailed instance information.",
    schema: monitoringErroredInstancesSchema,
    execute: async (context: ToolContext, params: any) => {
        if (!params.environment) {
            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
        }
        
        const environment = params.environment;
        const envConfig = getConfigForEnvironment(environment);
        const token = await context.getAccessToken(envConfig, false, environment);
        
        const duration = params.duration || "1h";
        
        const requestParams = {
            fields: "detail",
            orderBy: "lastupdateddate",
            limit: 50,
            offset: 0,
            q: `{timewindow:'${duration}'}`,
            integrationInstance: envConfig.integrationInstance,
        };

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

