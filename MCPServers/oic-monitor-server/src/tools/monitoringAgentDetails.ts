import { monitoringAgentDetailsSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringAgentDetailsTool: ToolDefinition = {
    name: "monitoringAgentDetails",
    description: "Retrieve status information for a specific agent within an agent group.",
    schema: monitoringAgentDetailsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        const key = params.key;

        if (!id) {
            throw new Error("Agent group id (id) is required");
        }
        if (!key) {
            throw new Error("Agent key (key) is required");
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
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/agentgroups/${id}/agents/${key}`,
            token,
            requestParams,
            true,
            environment,
            envConfig
        );
    },
};

