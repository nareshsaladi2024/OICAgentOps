import axios from "axios";

import { monitoringDiscardErroredInstancesSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringDiscardErroredInstancesTool: ToolDefinition = {
    name: "monitoringDiscardErroredInstances",
    description: "Discard multiple errored integration instances using filter criteria.",
    schema: monitoringDiscardErroredInstancesSchema,
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

        const response = await axios.post(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/discard`,
            null,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

