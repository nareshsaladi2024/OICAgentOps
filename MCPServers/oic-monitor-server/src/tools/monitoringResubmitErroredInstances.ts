import axios from "axios";

import { monitoringResubmitErroredInstancesSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringResubmitErroredInstancesTool: ToolDefinition = {
    name: "monitoringResubmitErroredInstances",
    description: "Bulk resubmit errored integration instances based on filter criteria.",
    schema: monitoringResubmitErroredInstancesSchema,
    execute: async (context: ToolContext, params: any) => {
        if (!params.environment) {
            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
        }

        const environment = params.environment;
        const envConfig = getConfigForEnvironment(environment);
        const token = await context.getAccessToken(envConfig, false, environment);
        
        const { instanceIds, environment: env, ...queryParams } = params;

        const requestParams = {
            ...queryParams,
            limit: 50,
            offset: 0,
            integrationInstance: envConfig.integrationInstance,
        };

        // If instanceIds are provided, send them in the body
        const requestBody = instanceIds ? { instanceIds } : null;

        const response = await axios.post(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/resubmit`,
            requestBody,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

