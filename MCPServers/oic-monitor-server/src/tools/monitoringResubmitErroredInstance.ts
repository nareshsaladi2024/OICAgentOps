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
            integrationInstance: envConfig.integrationInstance,
            return: "monitoringui"  // Request full response with job info
        };

        console.log(`[ResubmitSingle] Resubmitting instance ${id} in ${environment}`);

        const response = await axios.post(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${id}/resubmit`,
            {},  // Empty JSON body
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                params: requestParams,
            }
        );

        console.log(`[ResubmitSingle] Response:`, JSON.stringify(response.data));
        console.log(`[ResubmitSingle] Headers:`, JSON.stringify(response.headers));
        
        return response.data || { status: "submitted", instanceId: id };
    },
};

