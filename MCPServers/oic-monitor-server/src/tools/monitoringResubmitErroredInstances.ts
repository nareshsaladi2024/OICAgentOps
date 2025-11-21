import axios from "axios";

import { monitoringResubmitErroredInstancesSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const defaultEnv = "dev";

export const monitoringResubmitErroredInstancesTool: ToolDefinition = {
    name: "monitoringResubmitErroredInstances",
    description: "Bulk resubmit errored integration instances based on filter criteria.",
    schema: monitoringResubmitErroredInstancesSchema,
    execute: async (context: ToolContext, params: any) => {
        const token = await context.getAccessToken(context.defaultConfig, false, defaultEnv);
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        const response = await axios.post(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/resubmit`,
            null,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

