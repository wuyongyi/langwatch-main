/**
 * Alert triggering logic
 * 
 * Evaluates alert conditions against current metrics and triggers alerts
 * when thresholds are exceeded.
 * 
 * Requirements: 9.5, 10.5, 19.1, 19.2, 19.3
 */

import type {
  AlertRule,
  AlertConditionType,
  MetricValues,
  AlertTriggerResult,
} from "./types";

/**
 * Evaluate a single alert condition against metric values
 * 
 * @param condition - Alert condition to evaluate
 * @param metrics - Current metric values
 * @returns true if condition is met (alert should trigger), false otherwise
 */
export function evaluateCondition(
  condition: AlertConditionType,
  metrics: MetricValues
): boolean {
  let currentValue: number | undefined;

  // Extract the relevant metric value based on condition type
  switch (condition.metric) {
    case "error_rate":
      currentValue = metrics.errorRate;
      break;
    case "latency":
      currentValue = metrics.latency;
      break;
    case "cost":
      currentValue = metrics.cost;
      break;
    default:
      throw new Error(`Unknown metric type: ${(condition as any).metric}`);
  }

  // If metric value is not available, condition is not met
  if (currentValue === undefined || currentValue === null) {
    return false;
  }

  // Evaluate the condition based on operator
  return compareValues(currentValue, condition.operator, condition.threshold);
}

/**
 * Compare two values using the specified operator
 * 
 * @param value - Current value
 * @param operator - Comparison operator
 * @param threshold - Threshold to compare against
 * @returns true if comparison is true, false otherwise
 */
function compareValues(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Get the current metric value for a condition
 * 
 * @param condition - Alert condition
 * @param metrics - Current metric values
 * @returns Current metric value or undefined if not available
 */
function getCurrentValue(
  condition: AlertConditionType,
  metrics: MetricValues
): number | undefined {
  switch (condition.metric) {
    case "error_rate":
      return metrics.errorRate;
    case "latency":
      return metrics.latency;
    case "cost":
      return metrics.cost;
    default:
      return undefined;
  }
}

/**
 * Generate a human-readable message for an alert trigger
 * 
 * @param rule - Alert rule
 * @param currentValue - Current metric value
 * @param triggered - Whether the alert was triggered
 * @returns Human-readable message
 */
function generateAlertMessage(
  rule: AlertRule,
  currentValue: number,
  triggered: boolean
): string {
  const { condition } = rule;
  const metricName = getMetricDisplayName(condition.metric);
  const operatorText = getOperatorDisplayText(condition.operator);
  const valueText = formatMetricValue(condition.metric, currentValue);
  const thresholdText = formatMetricValue(condition.metric, condition.threshold);

  if (triggered) {
    return `Alert "${rule.name}" triggered: ${metricName} is ${valueText} (${operatorText} ${thresholdText})`;
  } else {
    return `Alert "${rule.name}" not triggered: ${metricName} is ${valueText} (threshold: ${operatorText} ${thresholdText})`;
  }
}

/**
 * Get display name for a metric type
 */
function getMetricDisplayName(metric: string): string {
  switch (metric) {
    case "error_rate":
      return "Error Rate";
    case "latency":
      return "Latency";
    case "cost":
      return "Cost";
    default:
      return metric;
  }
}

/**
 * Get display text for an operator
 */
function getOperatorDisplayText(operator: string): string {
  switch (operator) {
    case "gt":
      return "greater than";
    case "gte":
      return "greater than or equal to";
    case "lt":
      return "less than";
    case "lte":
      return "less than or equal to";
    case "eq":
      return "equal to";
    default:
      return operator;
  }
}

/**
 * Format a metric value for display
 */
function formatMetricValue(metric: string, value: number): string {
  switch (metric) {
    case "error_rate":
      return `${value.toFixed(2)}%`;
    case "latency":
      return `${value.toFixed(0)}ms`;
    case "cost":
      return `$${value.toFixed(2)}`;
    default:
      return value.toString();
  }
}

/**
 * Evaluate an alert rule against current metrics
 * 
 * @param rule - Alert rule to evaluate
 * @param metrics - Current metric values
 * @returns Alert trigger result
 * 
 * @example
 * ```typescript
 * const rule: AlertRule = {
 *   id: "alert-1",
 *   name: "High Error Rate",
 *   enabled: true,
 *   condition: {
 *     metric: "error_rate",
 *     operator: "gt",
 *     threshold: 5.0,
 *     timePeriod: 60
 *   },
 *   severity: "CRITICAL",
 *   notifications: []
 * };
 * 
 * const metrics: MetricValues = {
 *   errorRate: 7.5,
 *   timestamp: new Date()
 * };
 * 
 * const result = evaluateAlertRule(rule, metrics);
 * console.log(result.triggered); // true
 * console.log(result.message); // "Alert 'High Error Rate' triggered: Error Rate is 7.50% (greater than 5.00%)"
 * ```
 */
export function evaluateAlertRule(
  rule: AlertRule,
  metrics: MetricValues
): AlertTriggerResult {
  // If rule is disabled, it never triggers
  if (!rule.enabled) {
    const currentValue = getCurrentValue(rule.condition, metrics) ?? 0;
    return {
      triggered: false,
      rule,
      currentValue,
      threshold: rule.condition.threshold,
      operator: rule.condition.operator,
      message: `Alert "${rule.name}" is disabled`,
      timestamp: metrics.timestamp,
    };
  }

  // Evaluate the condition
  const triggered = evaluateCondition(rule.condition, metrics);
  const currentValue = getCurrentValue(rule.condition, metrics) ?? 0;

  return {
    triggered,
    rule,
    currentValue,
    threshold: rule.condition.threshold,
    operator: rule.condition.operator,
    message: generateAlertMessage(rule, currentValue, triggered),
    timestamp: metrics.timestamp,
  };
}

/**
 * Evaluate multiple alert rules against current metrics
 * 
 * @param rules - Alert rules to evaluate
 * @param metrics - Current metric values
 * @returns Array of alert trigger results
 * 
 * @example
 * ```typescript
 * const rules: AlertRule[] = [
 *   {
 *     id: "alert-1",
 *     name: "High Error Rate",
 *     enabled: true,
 *     condition: {
 *       metric: "error_rate",
 *       operator: "gt",
 *       threshold: 5.0,
 *       timePeriod: 60
 *     },
 *     severity: "CRITICAL",
 *     notifications: []
 *   },
 *   {
 *     id: "alert-2",
 *     name: "High Latency",
 *     enabled: true,
 *     condition: {
 *       metric: "latency",
 *       operator: "gt",
 *       threshold: 5000,
 *       timePeriod: 15
 *     },
 *     severity: "WARNING",
 *     notifications: []
 *   }
 * ];
 * 
 * const metrics: MetricValues = {
 *   errorRate: 7.5,
 *   latency: 3000,
 *   timestamp: new Date()
 * };
 * 
 * const results = evaluateAlertRules(rules, metrics);
 * const triggeredAlerts = results.filter(r => r.triggered);
 * console.log(`${triggeredAlerts.length} alerts triggered`);
 * ```
 */
export function evaluateAlertRules(
  rules: AlertRule[],
  metrics: MetricValues
): AlertTriggerResult[] {
  return rules.map((rule) => evaluateAlertRule(rule, metrics));
}

/**
 * Get only the triggered alerts from evaluation results
 * 
 * @param results - Alert trigger results
 * @returns Array of triggered alert results
 */
export function getTriggeredAlerts(
  results: AlertTriggerResult[]
): AlertTriggerResult[] {
  return results.filter((result) => result.triggered);
}

/**
 * Group triggered alerts by severity
 * 
 * @param results - Alert trigger results
 * @returns Map of severity to triggered alerts
 */
export function groupAlertsBySeverity(
  results: AlertTriggerResult[]
): Map<string, AlertTriggerResult[]> {
  const grouped = new Map<string, AlertTriggerResult[]>();

  for (const result of results) {
    if (!result.triggered) continue;

    const severity = result.rule.severity;
    if (!grouped.has(severity)) {
      grouped.set(severity, []);
    }
    grouped.get(severity)!.push(result);
  }

  return grouped;
}
