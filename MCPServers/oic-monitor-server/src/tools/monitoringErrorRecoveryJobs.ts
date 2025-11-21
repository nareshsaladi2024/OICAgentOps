import { monitoringErrorRecoveryJobsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/errors/recoveryJobs";

export const monitoringErrorRecoveryJobsTool: ToolDefinition = {
    name: "monitoringErrorRecoveryJobs",
    description: "List error recovery jobs with status to monitor bulk retry/discard operations.",
    schema: monitoringErrorRecoveryJobsSchema,
    execute: async (context: ToolContext, params: any) => {
        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        return context.fetchWithPagination(
            `${context.defaultConfig.apiBaseUrl}${endpoint}`,
            token,
            requestParams
        );
    },
};

