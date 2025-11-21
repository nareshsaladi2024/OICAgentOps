import { ToolDefinition } from "./types.js";
import { monitoringInstancesTool } from "./monitoringInstances.js";
import { monitoringInstanceDetailsTool } from "./monitoringInstanceDetails.js";
import { monitoringIntegrationsTool } from "./monitoringIntegrations.js";
import { monitoringIntegrationDetailsTool } from "./monitoringIntegrationDetails.js";
import { monitoringAgentGroupsTool } from "./monitoringAgentGroups.js";
import { monitoringAgentGroupDetailsTool } from "./monitoringAgentGroupDetails.js";
import { monitoringAgentsInGroupTool } from "./monitoringAgentsInGroup.js";
import { monitoringAuditRecordsTool } from "./monitoringAuditRecords.js";
import { monitoringErrorRecoveryJobsTool } from "./monitoringErrorRecoveryJobs.js";
import { monitoringErroredInstancesTool } from "./monitoringErroredInstances.js";
import { monitoringScheduledRunsTool } from "./monitoringScheduledRuns.js";
import { monitoringActivityStreamTool } from "./monitoringActivityStream.js";
import { monitoringLogsTool } from "./monitoringLogs.js";
import { monitoringAbortInstanceTool } from "./monitoringAbortInstance.js";
import { monitoringDiscardErroredInstanceTool } from "./monitoringDiscardErroredInstance.js";
import { monitoringDiscardErroredInstancesTool } from "./monitoringDiscardErroredInstances.js";
import { monitoringResubmitErroredInstanceTool } from "./monitoringResubmitErroredInstance.js";
import { monitoringResubmitErroredInstancesTool } from "./monitoringResubmitErroredInstances.js";
import { monitoringErrorRecoveryJobDetailsTool } from "./monitoringErrorRecoveryJobDetails.js";
import { monitoringErroredInstanceDetailsTool } from "./monitoringErroredInstanceDetails.js";
import { monitoringHistoryTool } from "./monitoringHistory.js";
import { monitoringActivityStreamDetailsTool } from "./monitoringActivityStreamDetails.js";
import { monitoringMessageCountSummaryTool } from "./monitoringMessageCountSummary.js";
import { monitoringAgentDetailsTool } from "./monitoringAgentDetails.js";

export const toolDefinitions: ToolDefinition[] = [
    monitoringInstancesTool,
    monitoringInstanceDetailsTool,
    monitoringIntegrationsTool,
    monitoringIntegrationDetailsTool,
    monitoringAgentGroupsTool,
    monitoringAgentGroupDetailsTool,
    monitoringAgentsInGroupTool,
    monitoringAuditRecordsTool,
    monitoringErrorRecoveryJobsTool,
    monitoringErroredInstancesTool,
    monitoringScheduledRunsTool,
    monitoringActivityStreamTool,
    monitoringLogsTool,
    monitoringAbortInstanceTool,
    monitoringDiscardErroredInstanceTool,
    monitoringDiscardErroredInstancesTool,
    monitoringResubmitErroredInstanceTool,
    monitoringResubmitErroredInstancesTool,
    monitoringErrorRecoveryJobDetailsTool,
    monitoringErroredInstanceDetailsTool,
    monitoringHistoryTool,
    monitoringActivityStreamDetailsTool,
    monitoringMessageCountSummaryTool,
    monitoringAgentDetailsTool,
];

const toolMap = new Map<string, ToolDefinition>();
toolDefinitions.forEach((tool) => toolMap.set(tool.name, tool));

export function getToolByName(name: string): ToolDefinition | undefined {
    return toolMap.get(name);
}

