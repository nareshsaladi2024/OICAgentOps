import axios from "axios";

import { monitoringLogsSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const endpoint = "/ic/api/integration/v1/monitoring/instances";
const defaultEnv = "dev";

export const monitoringLogsTool: ToolDefinition = {
    name: "monitoringLogs",
    description: "Download execution logs for a specific integration instance.",
    schema: monitoringLogsSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        if (!id) {
            throw new Error("Instance id (id) is required");
        }

        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;

        const url = `${context.defaultConfig.apiBaseUrl}${endpoint}/${id}/logs`;
        let token = await context.getAccessToken(context.defaultConfig, false, defaultEnv);

        try {
            const logResponse = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
                responseType: "text",
            });
            return { logContent: logResponse.data };
        } catch (error: any) {
            if (error.response?.status === 401) {
                token = await context.getAccessToken(context.defaultConfig, true, defaultEnv);
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

