import { AlertType } from "@prisma/client";
import type { Trace } from "~/server/tracer/types";

/**
 * Determines the alert priority based on trace risk level and error status.
 * 
 * Priority matrix:
 * - High risk + error = CRITICAL
 * - High risk + no error = WARNING
 * - Medium risk + error = WARNING
 * - Medium risk + no error = INFO
 * - Low risk + error = INFO
 * - Low risk + no error = INFO
 * - No risk level + error = WARNING (default)
 * - No risk level + no error = INFO (default)
 * 
 * @param trace - The trace to determine priority for
 * @returns The alert priority level
 */
export function determineAlertPriority(trace: Trace): AlertType {
  const riskLevel = trace.metadata?.["langwatch.risk.level"] as string | undefined;
  const hasError = trace.error?.has_error === true;

  // High risk operations
  if (riskLevel === "high") {
    return hasError ? AlertType.CRITICAL : AlertType.WARNING;
  }

  // Medium risk operations
  if (riskLevel === "medium") {
    return hasError ? AlertType.WARNING : AlertType.INFO;
  }

  // Low risk operations (explicit)
  if (riskLevel === "low") {
    return AlertType.INFO;
  }

  // Default behavior when no risk level is specified
  return hasError ? AlertType.WARNING : AlertType.INFO;
}
