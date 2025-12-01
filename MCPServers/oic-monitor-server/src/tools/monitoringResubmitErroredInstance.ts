import axios from "axios";

import { monitoringResubmitErroredInstanceSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringResubmitErroredInstanceTool: ToolDefinition = {
    name: "monitoringResubmitErroredInstance",
    description: "Resubmit a single errored integration instance for reprocessing.",
    schema: monitoringResubmitErroredInstanceSchema,
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

        const response = await axios.post(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${id}/resubmit`,
            null,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

