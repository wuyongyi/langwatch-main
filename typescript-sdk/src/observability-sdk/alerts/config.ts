/**
 * Alert rule configuration manager
 * 
 * Provides functionality to create, update, and manage alert rules
 */

import type {
  AlertRule,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from "./types";

/**
 * In-memory storage for alert rules
 * In production, this would be backed by a database
 */
const alertRules = new Map<string, AlertRule>();

/**
 * Generate a unique ID for an alert rule
 */
function generateAlertRuleId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new alert rule
 * 
 * @param input - Alert rule configuration
 * @returns The created alert rule with generated ID and timestamps
 * 
 * @example
 * ```typescript
 * const rule = createAlertRule({
 *   name: "High Error Rate",
 *   enabled: true,
 *   condition: {
 *     metric: "error_rate",
 *     operator: "gt",
 *     threshold: 5.0,
 *     timePeriod: 60
 *   },
 *   severity: "CRITICAL",
 *   notifications: [
 *     { channel: "email", recipients: ["team@example.com"] }
 *   ]
 * });
 * ```
 */
export function createAlertRule(input: CreateAlertRuleInput): AlertRule {
  const now = Date.now();
  const rule: AlertRule = {
    ...input,
    id: generateAlertRuleId(),
    createdAt: now,
    updatedAt: now,
  };

  alertRules.set(rule.id, rule);
  return rule;
}

/**
 * Get an alert rule by ID
 * 
 * @param id - Alert rule ID
 * @returns The alert rule or undefined if not found
 */
export function getAlertRule(id: string): AlertRule | undefined {
  return alertRules.get(id);
}

/**
 * Get all alert rules
 * 
 * @param options - Optional filtering options
 * @returns Array of alert rules
 */
export function getAllAlertRules(options?: {
  enabled?: boolean;
  metric?: string;
}): AlertRule[] {
  let rules = Array.from(alertRules.values());

  if (options?.enabled !== undefined) {
    rules = rules.filter((rule) => rule.enabled === options.enabled);
  }

  if (options?.metric) {
    rules = rules.filter((rule) => rule.condition.metric === options.metric);
  }

  return rules;
}

/**
 * Update an existing alert rule
 * 
 * @param id - Alert rule ID
 * @param updates - Partial updates to apply
 * @returns The updated alert rule or undefined if not found
 * 
 * @example
 * ```typescript
 * const updated = updateAlertRule("alert_123", {
 *   enabled: false,
 *   condition: {
 *     ...existingCondition,
 *     threshold: 10.0
 *   }
 * });
 * ```
 */
export function updateAlertRule(
  id: string,
  updates: UpdateAlertRuleInput
): AlertRule | undefined {
  const existing = alertRules.get(id);
  if (!existing) {
    return undefined;
  }

  const updated: AlertRule = {
    ...existing,
    ...updates,
    id: existing.id, // Preserve ID
    createdAt: existing.createdAt, // Preserve creation time
    updatedAt: Date.now(),
  };

  alertRules.set(id, updated);
  return updated;
}

/**
 * Delete an alert rule
 * 
 * @param id - Alert rule ID
 * @returns true if deleted, false if not found
 */
export function deleteAlertRule(id: string): boolean {
  return alertRules.delete(id);
}

/**
 * Clear all alert rules (useful for testing)
 */
export function clearAllAlertRules(): void {
  alertRules.clear();
}

/**
 * Validate an alert rule configuration
 * 
 * @param rule - Alert rule to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateAlertRule(
  rule: CreateAlertRuleInput | AlertRule
): string[] {
  const errors: string[] = [];

  // Validate name
  if (!rule.name || rule.name.trim().length === 0) {
    errors.push("Alert rule name is required");
  }

  // Validate condition
  if (!rule.condition) {
    errors.push("Alert condition is required");
  } else {
    // Validate threshold
    if (typeof rule.condition.threshold !== "number") {
      errors.push("Threshold must be a number");
    } else if (rule.condition.threshold < 0) {
      errors.push("Threshold must be non-negative");
    }

    // Validate error rate threshold (0-100)
    if (
      rule.condition.metric === "error_rate" &&
      rule.condition.threshold > 100
    ) {
      errors.push("Error rate threshold must be between 0 and 100");
    }

    // Validate time period
    const validTimePeriods = [5, 15, 30, 60, 1440];
    if (!validTimePeriods.includes(rule.condition.timePeriod)) {
      errors.push(
        `Time period must be one of: ${validTimePeriods.join(", ")}`
      );
    }

    // Validate operator
    const validOperators = ["gt", "gte", "lt", "lte", "eq"];
    if (!validOperators.includes(rule.condition.operator)) {
      errors.push(`Operator must be one of: ${validOperators.join(", ")}`);
    }
  }

  // Validate severity
  const validSeverities = ["INFO", "WARNING", "CRITICAL"];
  if (!validSeverities.includes(rule.severity)) {
    errors.push(`Severity must be one of: ${validSeverities.join(", ")}`);
  }

  // Validate notifications
  if (!rule.notifications || rule.notifications.length === 0) {
    errors.push("At least one notification channel is required");
  } else {
    rule.notifications.forEach((notification, index) => {
      if (notification.channel === "email") {
        if (!notification.recipients || notification.recipients.length === 0) {
          errors.push(
            `Email notification ${index + 1} must have at least one recipient`
          );
        } else {
          // Basic email validation
          notification.recipients.forEach((email) => {
            if (!email.includes("@")) {
              errors.push(`Invalid email address: ${email}`);
            }
          });
        }
      } else if (notification.channel === "webhook") {
        if (!notification.url) {
          errors.push(`Webhook notification ${index + 1} must have a URL`);
        } else if (!notification.url.startsWith("http")) {
          errors.push(
            `Webhook URL must start with http:// or https://: ${notification.url}`
          );
        }
      }
    });
  }

  return errors;
}
