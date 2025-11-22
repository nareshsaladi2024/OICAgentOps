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
        const { instanceIds, ...queryParams } = params;

        const requestParams = {
            ...queryParams,
            integrationInstance: context.defaultConfig.integrationInstance,
        };

        // If instanceIds are provided, send them in the body
        const requestBody = instanceIds ? { instanceIds } : null;

        const response = await axios.post(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/resubmit`,
            requestBody,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

