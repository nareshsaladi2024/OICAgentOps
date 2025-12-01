import { monitoringActivityStreamDetailsSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringActivityStreamDetailsTool: ToolDefinition = {
    name: "monitoringActivityStreamDetails",
    description: "Retrieve a specific activity stream detail payload (including large payload downloads).",
    schema: monitoringActivityStreamDetailsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        const key = params.key;

        if (!id) {
            throw new Error("Instance id (id) is required");
        }
        if (!key) {
            throw new Error("Activity stream key (key) is required");
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
        delete requestParams.key;
        delete requestParams.environment;

        return context.fetchSingle(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/activityStreamDetails/${key}`,
            token,
            requestParams,
            true,
            environment,
            envConfig
        );
    },
};

