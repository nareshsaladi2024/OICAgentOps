import axios from "axios";

import { monitoringDiscardErroredInstancesSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const defaultEnv = "dev";

export const monitoringDiscardErroredInstancesTool: ToolDefinition = {
    name: "monitoringDiscardErroredInstances",
    description: "Discard multiple errored integration instances using filter criteria.",
    schema: monitoringDiscardErroredInstancesSchema,
    execute: async (context: ToolContext, params: any) => {
        const token = await context.getAccessToken(context.defaultConfig, false, defaultEnv);
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        const response = await axios.post(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/discard`,
            null,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

