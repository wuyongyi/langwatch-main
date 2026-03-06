/**
 * Email notification handler for alert system
 * 
 * Sends alert notifications via email when alerts are triggered.
 * 
 * Requirements: 19.4
 */

import type { AlertTriggerResult, EmailNotificationConfig } from "../types";

/**
 * Email content structure for alert notifications
 */
export interface AlertEmailContent {
  to: string[];
  subject: string;
  html: string;
}

/**
 * Format alert details as HTML for email body
 * 
 * @param result - Alert trigger result
 * @returns HTML string with formatted alert details
 */
function formatAlertDetailsHtml(result: AlertTriggerResult): string {
  const { rule, currentValue, threshold, operator, message, timestamp } = result;

  const severityColor = {
    INFO: "#3B82F6",
    WARNING: "#F59E0B",
    CRITICAL: "#EF4444",
  }[rule.severity];

  const metricName = {
    error_rate: "Error Rate",
    latency: "Latency",
    cost: "Cost",
  }[rule.condition.metric];

  const formatValue = (metric: string, value: number): string => {
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
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alert Notification</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <div style="border-left: 4px solid ${severityColor}; padding-left: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111827;">
            Alert Triggered
          </h1>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            ${new Date(timestamp).toLocaleString()}
          </p>
        </div>

        <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #111827;">
            ${rule.name}
          </h2>
          ${rule.description ? `<p style="margin: 0 0 12px 0; color: #6b7280;">${rule.description}</p>` : ""}
          <p style="margin: 0; font-size: 16px; color: #111827;">
            ${message}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
              Severity
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; background-color: ${severityColor}; color: white;">
                ${rule.severity}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
              Metric
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              ${metricName}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
              Current Value
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: ${severityColor};">
              ${formatValue(rule.condition.metric, currentValue)}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
              Threshold
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              ${operator} ${formatValue(rule.condition.metric, threshold)}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: 600; color: #6b7280;">
              Time Period
            </td>
            <td style="padding: 12px;">
              ${rule.condition.timePeriod} minutes
            </td>
          </tr>
        </table>

        ${
          rule.metadata && Object.keys(rule.metadata).length > 0
            ? `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">
            Additional Context
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${Object.entries(rule.metadata)
              .map(
                ([key, value]) => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
                  ${key}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                  ${value}
                </td>
              </tr>
            `
              )
              .join("")}
          </table>
        </div>
        `
            : ""
        }

        <div style="padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">
            This is an automated alert notification from LangWatch.
          </p>
          <p style="margin: 8px 0 0 0;">
            Alert ID: ${rule.id}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate email subject line for alert notification
 * 
 * @param result - Alert trigger result
 * @returns Email subject string
 */
function generateEmailSubject(result: AlertTriggerResult): string {
  const { rule } = result;
  return `[${rule.severity}] ${rule.name} - LangWatch Alert`;
}

/**
 * Create email content for an alert notification
 * 
 * @param result - Alert trigger result
 * @param config - Email notification configuration
 * @returns Email content ready to send
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
 * const config: EmailNotificationConfig = {
 *   channel: "email",
 *   recipients: ["team@example.com"]
 * };
 * 
 * const emailContent = createAlertEmailContent(result, config);
 * ```
 */
export function createAlertEmailContent(
  result: AlertTriggerResult,
  config: EmailNotificationConfig
): AlertEmailContent {
  return {
    to: config.recipients,
    subject: generateEmailSubject(result),
    html: formatAlertDetailsHtml(result),
  };
}

/**
 * Email sender function type
 * This allows for dependency injection in tests
 */
export type EmailSender = (content: AlertEmailContent) => Promise<void>;

/**
 * Send alert notification via email
 * 
 * @param result - Alert trigger result
 * @param config - Email notification configuration
 * @param emailSender - Email sender function (for dependency injection)
 * @returns Promise that resolves when email is sent
 * 
 * @throws Error if email sending fails
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
 * const config: EmailNotificationConfig = {
 *   channel: "email",
 *   recipients: ["team@example.com"]
 * };
 * 
 * await sendAlertEmail(result, config, myEmailSender);
 * ```
 */
export async function sendAlertEmail(
  result: AlertTriggerResult,
  config: EmailNotificationConfig,
  emailSender: EmailSender
): Promise<void> {
  const emailContent = createAlertEmailContent(result, config);
  await emailSender(emailContent);
}
