import { monitoringMessageCountSummarySchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/integrations/messages/summary";

export const monitoringMessageCountSummaryTool: ToolDefinition = {
    name: "monitoringMessageCountSummary",
    description: "Retrieve message count summaries across integrations.",
    schema: monitoringMessageCountSummarySchema,
    execute: async (context: ToolContext, params: any) => {
        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}${endpoint}`,
            token,
            requestParams
        );
    },
};

