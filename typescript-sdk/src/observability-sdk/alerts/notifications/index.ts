/**
 * Notification handlers for alert system
 * 
 * Exports notification channel implementations
 */

export {
  createAlertEmailContent,
  sendAlertEmail,
  type AlertEmailContent,
  type EmailSender,
} from "./email";

export {
  formatAlertWebhookPayload,
  sendAlertWebhook,
  defaultWebhookSender,
  type AlertWebhookPayload,
  type WebhookSender,
} from "./webhook";

export {
  sendAllNotifications,
  sendNotification,
  type NotificationDependencies,
} from "./dispatcher";
