/**
 * Webhook notification handler for alert system
 * 
 * Sends alert notifications to configured webhook URLs when alerts are triggered.
 * 
 * Requirements: 19.5
 */

import type { AlertTriggerResult, WebhookNotificationConfig } from "../types";

/**
 * Webhook payload structure for alert notifications
 */
export interface AlertWebhookPayload {
  alert: {
    id: string;
    name: string;
    description?: string;
    severity: string;
  };
  condition: {
    metric: string;
    operator: string;
    threshold: number;
    timePeriod: number;
  };
  current: {
    value: number;
    timestamp: string;
  };
  message: string;
  metadata?: Record<string, string>;
}

/**
 * Format alert details as webhook payload
 * 
 * @param result - Alert trigger result
 * @returns Webhook payload with formatted alert details
 */
export function formatAlertWebhookPayload(
  result: AlertTriggerResult
): AlertWebhookPayload {
  const { rule, currentValue, threshold, operator, message, timestamp } = result;

  return {
    alert: {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
    },
    condition: {
      metric: rule.condition.metric,
      operator,
      threshold,
      timePeriod: rule.condition.timePeriod,
    },
    current: {
      value: currentValue,
      timestamp: timestamp.toISOString(),
    },
    message,
    metadata: rule.metadata,
  };
}

/**
 * Webhook sender function type
 * This allows for dependency injection in tests
 */
export type WebhookSender = (
  url: string,
  payload: AlertWebhookPayload,
  headers?: Record<string, string>
) => Promise<void>;

/**
 * Default webhook sender using fetch API
 * 
 * @param url - Webhook URL to POST to
 * @param payload - Alert webhook payload
 * @param headers - Optional custom headers
 * @returns Promise that resolves when webhook is sent
 * 
 * @throws Error if webhook request fails
 */
export async function defaultWebhookSender(
  url: string,
  payload: AlertWebhookPayload,
  headers?: Record<string, string>
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Webhook request failed: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Send alert notification via webhook
 * 
 * @param result - Alert trigger result
 * @param config - Webhook notification configuration
 * @param webhookSender - Webhook sender function (for dependency injection)
 * @returns Promise that resolves when webhook is sent
 * 
 * @throws Error if webhook sending fails
 * 
 * @example
 * ```typescript
 * const result: AlertTriggerResult = {
 *   triggered: true,
 *   rule: {
 *     id: "alert-1",
 *     name: "High Error Rate",
 *     severity: "CRITICAL",
 *     condition: {
 *       metric: "error_rate",
 *       operator: "gt",
 *       threshold: 5.0,
 *       timePeriod: 60
 *     },
 *     notifications: []
 *   },
 *   currentValue: 7.5,
 *   threshold: 5.0,
 *   operator: "gt",
 *   message: "Error rate is 7.50% (greater than 5.00%)",
 *   timestamp: new Date()
 * };
 * 
 * const config: WebhookNotificationConfig = {
 *   channel: "webhook",
 *   url: "https://hooks.slack.com/services/...",
 *   headers: {
 *     "Authorization": "Bearer token123"
 *   }
 * };
 * 
 * await sendAlertWebhook(result, config, defaultWebhookSender);
 * ```
 */
export async function sendAlertWebhook(
  result: AlertTriggerResult,
  config: WebhookNotificationConfig,
  webhookSender: WebhookSender = defaultWebhookSender
): Promise<void> {
  const payload = formatAlertWebhookPayload(result);
  await webhookSender(config.url, payload, config.headers);
}
