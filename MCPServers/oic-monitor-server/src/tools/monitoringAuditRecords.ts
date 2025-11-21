import { monitoringAuditRecordsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/auditRecords";

export const monitoringAuditRecordsTool: ToolDefinition = {
    name: "monitoringAuditRecords",
    description: "Retrieve audit records for integration design-time actions.",
    schema: monitoringAuditRecordsSchema,
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

