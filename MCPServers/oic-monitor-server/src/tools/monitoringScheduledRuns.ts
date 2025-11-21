import { monitoringScheduledRunsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/futureruns";

export const monitoringScheduledRunsTool: ToolDefinition = {
    name: "monitoringScheduledRuns",
    description: "Retrieve upcoming scheduled integration runs and their execution metadata.",
    schema: monitoringScheduledRunsSchema,
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

