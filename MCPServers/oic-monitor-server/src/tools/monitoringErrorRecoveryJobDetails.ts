import { monitoringErrorRecoveryJobDetailsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringErrorRecoveryJobDetailsTool: ToolDefinition = {
    name: "monitoringErrorRecoveryJobDetails",
    description: "Retrieve detailed information for a specific error recovery job.",
    schema: monitoringErrorRecoveryJobDetailsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        if (!id) {
            throw new Error("Error recovery job id (id) is required");
        }

        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/recoveryJobs/${id}`,
            token,
            requestParams
        );
    },
};

