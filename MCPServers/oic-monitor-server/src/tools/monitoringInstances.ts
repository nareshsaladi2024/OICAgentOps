import { monitoringInstancesSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

export const monitoringInstancesTool: ToolDefinition = {
    name: "monitoringInstances",
    description: "Retrieve OIC monitor queue requests pending in the queue filtered by duration, status, and environment. Returns counts and detailed instance information.",
    schema: monitoringInstancesSchema,
    execute: async (context: ToolContext, params: any) => {
        if (!params.environment) {
            throw new Error("Environment parameter is required. Valid values: 'dev', 'qa3', 'prod1', 'prod3'");
        }
        if (!params.duration) {
            throw new Error("Duration parameter is required. Valid values: '1h', '6h', '1d', '2d', '3d', 'RETENTIONPERIOD'");
        }
        if (!params.status) {
            throw new Error("Status parameter is required. Valid values: 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABORTED'");
        }

        const environment = params.environment;
        const envConfig = getConfigForEnvironment(environment);
        const token = await context.getAccessToken(envConfig, false, environment);
        const endpoint = "/ic/api/integration/v1/monitoring/instances";

        const duration = params.duration;
        const status = params.status;

        const requestParams = {
            ...params,
            fields: "detail",
            orderBy: "lastupdateddate",
            limit: 50,
            offset: 0,
            groupBy: "integration",
            q: `{timewindow:'${duration}', status:'${status}', integration-style:'appdriven', includePurged:'yes'}`,
            integrationInstance: envConfig.integrationInstance,
        };

        delete requestParams.duration;
        delete requestParams.status;
        delete requestParams.environment;

        return context.fetchWithPagination(`${envConfig.apiBaseUrl}${endpoint}`, token, requestParams);
    },
};

