import axios from "axios";

import { monitoringResubmitErroredInstanceSchema } from "../schemas.js";
import { ToolDefinition, ToolContext } from "./types.js";

const defaultEnv = "dev";

export const monitoringResubmitErroredInstanceTool: ToolDefinition = {
    name: "monitoringResubmitErroredInstance",
    description: "Resubmit a single errored integration instance for reprocessing.",
    schema: monitoringResubmitErroredInstanceSchema,
    execute: async (context: ToolContext, params: any) => {
        const id = params.id;
        if (!id) {
            throw new Error("Instance id (id) is required");
        }

        const token = await context.getAccessToken(context.defaultConfig, false, defaultEnv);
        const requestParams = {
            ...params,
            integrationInstance: context.defaultConfig.integrationInstance,
        };
        delete requestParams.id;

        const response = await axios.post(
            `${context.defaultConfig.apiBaseUrl}/ic/api/integration/v1/monitoring/errors/${id}/resubmit`,
            null,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams,
            }
        );

        return response.data;
    },
};

