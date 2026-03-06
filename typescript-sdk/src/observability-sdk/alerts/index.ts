/**
 * Alert rule configuration module
 * 
 * Provides types and functions for configuring threshold-based alerts
 * for error rate, latency, and cost monitoring.
 * 
 * @example
 * ```typescript
 * import { createAlertRule } from "langwatch/observability-sdk/alerts";
 * 
 * const rule = createAlertRule({
 *   name: "High Error Rate Alert",
 *   enabled: true,
 *   condition: {
 *     metric: "error_rate",
 *     operator: "gt",
 *     threshold: 5.0,
 *     timePeriod: 60
 *   },
 *   severity: "CRITICAL",
 *   notifications: [
 *     {
 *       channel: "email",
 *       recipients: ["team@example.com"]
 *     }
 *   ]
 * });
 * ```
 */

export * from "./types";
export * from "./config";
export * from "./trigger";
export * from "./notifications";
