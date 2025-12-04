import axios from "axios";

import { monitoringResubmitErroredInstancesSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringResubmitErroredInstancesTool: ToolDefinition = {
    name: "monitoringResubmitErroredInstances",
    description: "Bulk resubmit errored integration instances by providing an array of instance ID strings (max 50). Returns recovery job IDs.",
    schema: monitoringResubmitErroredInstancesSchema,
    execute: async (context: ToolContext, params: any) => {
        if (!params.environment) {
            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
        }
        
        if (!params.instanceIds || params.instanceIds.length === 0) {
            throw new Error("instanceIds parameter is required. Provide an array of instance IDs to resubmit.");
        }

        const environment = params.environment;
        const envConfig = getConfigForEnvironment(environment);
        const token = await context.getAccessToken(envConfig, false, environment);
        
        const instanceIds: string[] = params.instanceIds.map((id: any) => String(id));
        
        if (instanceIds.length > 50) {
            throw new Error(`Maximum 50 instanceIds allowed per request. Received: ${instanceIds.length}`);
        }

        // Query params: return=monitoringui and integrationInstance
        const requestParams = {
            integrationInstance: envConfig.integrationInstance,
            return: "monitoringui"
        };

        // Request body: {"ids": ["id1", "id2", ...]}
        const requestBody = {
            ids: instanceIds
        };

        console.log(`[Resubmit] Bulk resubmitting ${instanceIds.length} instances in ${environment}`);
        console.log(`[Resubmit] Request body: ${JSON.stringify(requestBody)}`);

        const response = await axios.post(
            `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/resubmit`,
            requestBody,
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                params: requestParams,
            }
        );

        console.log(`[Resubmit] Response: ${JSON.stringify(response.data)}`);
        return response.data;
    },
};
