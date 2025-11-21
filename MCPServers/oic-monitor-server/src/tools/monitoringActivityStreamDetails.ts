import { monitoringActivityStreamDetailsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringActivityStreamDetailsTool: ToolDefinition = {
    name: "monitoringActivityStreamDetails",
    description: "Retrieve a specific activity stream detail payload (including large payload downloads).",
    schema: monitoringActivityStreamDetailsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        const key = params.key;

        if (!id) {
            throw new Error("Instance id (id) is required");
        }
        if (!key) {
            throw new Error("Activity stream key (key) is required");
        }

        const token = await context.getAccessToken(context.defaultConfig, false, "dev");
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;
        delete requestParams.key;

        return context.fetchSingle(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/instances/${id}/activityStreamDetails/${key}`,
            token,
            requestParams
        );
    },
};

