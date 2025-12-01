import { monitoringMessageCountSummarySchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/integrations/messages/summary";

export const monitoringMessageCountSummaryTool: ToolDefinition = {
    name: "monitoringMessageCountSummary",
    description: "Retrieve message count summaries across integrations.",
    schema: monitoringMessageCountSummarySchema,
    execute: async (context: ToolContext, params: any) => {
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
        
        delete requestParams.environment;

        return context.fetchSingle(
            `${envConfig.apiBaseUrl}${endpoint}`,
            token,
            requestParams,
            true,
            environment,
            envConfig
        );
    },
};

