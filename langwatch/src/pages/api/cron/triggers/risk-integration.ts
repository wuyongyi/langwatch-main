import type { AlertType, Trigger } from "@prisma/client";
import { determineAlertPriority } from "./risk-based-alert-prioritization";
import type { TriggerData } from "./types";

interface RiskBasedPriorityInput {
  trigger: Trigger;
  triggerData: TriggerData[];
}

interface RiskBasedPriorityOutput {
  alertType: AlertType | null;
  triggerData: TriggerData[];
}

/**
 * Applies risk-based priority to a trigger based on the traces it contains.
 * 
 * If the trigger has no explicit alertType set, this function will:
 * 1. Determine the priority for each trace based on its risk level and error status
 * 2. Set the trigger's alertType to the highest priority found
 * 3. Add risk level information to each trigger data item
 * 
 * If the trigger already has an explicit alertType, it will be preserved,
 * but risk level information will still be added to the trigger data.
 * 
 * @param input - The trigger and its associated trace data
 * @returns The trigger with updated alertType and enriched trigger data
 */
export function applyRiskBasedPriority({
  trigger,
  triggerData,
}: RiskBasedPriorityInput): RiskBasedPriorityOutput {
  // If no trigger data, return as-is
  if (triggerData.length === 0) {
    return {
      alertType: trigger.alertType,
      triggerData,
    };
  }

  // Enrich trigger data with risk level information
  const enrichedTriggerData = triggerData.map((data) => ({
    ...data,
    riskLevel: data.fullTrace.metadata?.["langwatch.risk.level"] as
      | string
      | undefined,
  }));

  // If trigger already has an explicit alertType, preserve it
  if (trigger.alertType !== null) {
    return {
      alertType: trigger.alertType,
      triggerData: enrichedTriggerData,
    };
  }

  // Determine priority for each trace and find the highest
  const priorities = triggerData.map((data) =>
    determineAlertPriority(data.fullTrace),
  );

  // Priority order: CRITICAL > WARNING > INFO
  const highestPriority = priorities.reduce((highest, current) => {
    if (current === "CRITICAL") return "CRITICAL";
    if (current === "WARNING" && highest !== "CRITICAL") return "WARNING";
    return highest;
  }, priorities[0]);

  return {
    alertType: highestPriority,
    triggerData: enrichedTriggerData,
  };
}
