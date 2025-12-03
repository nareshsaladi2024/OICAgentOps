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

        const requestParams = {
            integrationInstance: envConfig.integrationInstance,
            return: "monitoringui"
        };

        console.log(`[Resubmit] Bulk resubmitting ${instanceIds.length} instances in ${environment}`);

        const results = {
            totalRequested: instanceIds.length,
            successCount: 0,
            failedCount: 0,
            recoveryJobIds: [] as string[],
            details: [] as any[]
        };

        for (const instanceId of instanceIds) {
            try {
                const response = await axios.post(
                    `${envConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${instanceId}/resubmit`,
                    {},
                    {
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        params: requestParams,
                    }
                );

                const recoveryJobId = response.data?.recoveryJobId || null;
                const resubmitSuccessful = response.data?.resubmitSuccessful || false;

                if (resubmitSuccessful) {
                    results.successCount++;
                    if (recoveryJobId) {
                        results.recoveryJobIds.push(recoveryJobId);
                    }
                } else {
                    results.failedCount++;
                }

                results.details.push({
                    instanceId,
                    recoveryJobId,
                    resubmitSuccessful
                });

                console.log(`[Resubmit] ${instanceId} -> recoveryJobId: ${recoveryJobId}`);
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || error.response?.data?.title || error.message || 'Unknown error';
                results.failedCount++;
                results.details.push({
                    instanceId,
                    recoveryJobId: null,
                    resubmitSuccessful: false,
                    error: errorMsg
                });
                console.log(`[Resubmit] Failed ${instanceId}: ${errorMsg}`);
            }
        }

        console.log(`[Resubmit] Completed: ${results.successCount}/${results.totalRequested} successful`);
        return results;
    },
};
