import axios from "axios";

import { monitoringLogsSchema } from "../schemas.js";
import { getConfigForEnvironment } from "../config.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/instances";

export const monitoringLogsTool: ToolDefinition = {
    name: "monitoringLogs",
    description: "Download execution logs for a specific integration instance.",
    schema: monitoringLogsSchema,
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
        
        const requestParams = {
            ...params,
            integrationInstance: envConfig.integrationInstance,
        };
        delete requestParams.id;
        delete requestParams.environment;

        const url = `${envConfig.apiBaseUrl}${endpoint}/${id}/logs`;
        let token = await context.getAccessToken(envConfig, false, environment);

        try {
            const logResponse = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
                responseType: "text",
            });
            return { logContent: logResponse.data };
        } catch (error: any) {
            if (error.response?.status === 401) {
                token = await context.getAccessToken(envConfig, true, environment);
                const retryResponse = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: requestParams,
                    responseType: "text",
                });
                return { logContent: retryResponse.data };
            }
            throw error;
        }
    },
};

