/**
 * Notification dispatcher for alert system
 * 
 * Routes alert notifications to appropriate channels (email, webhook)
 * 
 * Requirements: 19.4, 19.5
 */

import type {
  AlertTriggerResult,
  EmailNotificationConfig,
  NotificationConfig,
  WebhookNotificationConfig,
} from "../types";
import { sendAlertEmail, type EmailSender } from "./email";
import { sendAlertWebhook, type WebhookSender } from "./webhook";

/**
 * Notification dependencies for dependency injection
 */
export interface NotificationDependencies {
  emailSender?: EmailSender;
  webhookSender?: WebhookSender;
}

/**
 * Send alert notification to a single channel
 * 
 * @param result - Alert trigger result
 * @param config - Notification channel configuration
 * @param dependencies - Notification dependencies (for dependency injection)
 * @returns Promise that resolves when notification is sent
 * 
 * @throws Error if notification sending fails
 */
export async function sendNotification(
  result: AlertTriggerResult,
  config: NotificationConfig,
  dependencies: NotificationDependencies = {}
): Promise<void> {
  switch (config.channel) {
    case "email":
      if (!dependencies.emailSender) {
        throw new Error("Email sender not configured");
      }
      await sendAlertEmail(
        result,
        config as EmailNotificationConfig,
        dependencies.emailSender
      );
      break;

    case "webhook":
      if (!dependencies.webhookSender) {
        throw new Error("Webhook sender not configured");
      }
      await sendAlertWebhook(
        result,
        config as WebhookNotificationConfig,
        dependencies.webhookSender
      );
      break;

    default:
      throw new Error(
        `Unknown notification channel: ${(config as any).channel}`
      );
  }
}

/**
 * Send alert notifications to all configured channels
 * 
 * @param result - Alert trigger result
 * @param dependencies - Notification dependencies (for dependency injection)
 * @returns Promise that resolves when all notifications are sent
 * 
 * @example
 * ```typescript
 * const result: AlertTriggerResult = {
 *   triggered: true,
 *   rule: {
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
 *     notifications: [
 *       { channel: "email", recipients: ["team@example.com"] },
 *       { channel: "webhook", url: "https://hooks.slack.com/..." }
 *     ]
 *   },
 *   currentValue: 7.5,
 *   threshold: 5.0,
 *   operator: "gt",
 *   message: "Error rate is 7.50% (greater than 5.00%)",
 *   timestamp: new Date()
 * };
 * 
 * await sendAllNotifications(result, {
 *   emailSender: myEmailSender,
 *   webhookSender: myWebhookSender
 * });
 * ```
 */
export async function sendAllNotifications(
  result: AlertTriggerResult,
  dependencies: NotificationDependencies = {}
): Promise<void> {
  const { rule } = result;

  // Send notifications in parallel
  await Promise.all(
    rule.notifications.map((config) =>
      sendNotification(result, config, dependencies)
    )
  );
}
