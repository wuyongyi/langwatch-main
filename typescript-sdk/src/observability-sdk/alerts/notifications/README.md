# Alert Notifications

This module provides notification handlers for the alert system, enabling alerts to be sent via multiple channels when thresholds are exceeded.

## Supported Channels

- **Email**: Send formatted HTML emails with alert details
- **Webhook**: POST JSON payloads to configured webhook URLs

## Usage

### Email Notifications

```typescript
import { sendAlertEmail, createAlertEmailContent } from "langwatch/observability-sdk/alerts";

// Create email content
const emailContent = createAlertEmailContent(alertResult, {
  channel: "email",
  recipients: ["team@example.com", "oncall@example.com"]
});

// Send email (requires email sender implementation)
await sendAlertEmail(alertResult, emailConfig, myEmailSender);
```

### Webhook Notifications

```typescript
import { sendAlertWebhook, defaultWebhookSender } from "langwatch/observability-sdk/alerts";

// Send webhook notification
await sendAlertWebhook(alertResult, {
  channel: "webhook",
  url: "https://hooks.slack.com/services/...",
  headers: {
    "Authorization": "Bearer token123",
    "X-Custom-Header": "value"
  }
}, defaultWebhookSender);

// Or use with dispatcher
import { sendNotification } from "langwatch/observability-sdk/alerts";

await sendNotification(alertResult, {
  channel: "webhook",
  url: "https://hooks.slack.com/services/...",
  headers: {
    "X-Custom-Header": "value"
  }
}, {
  webhookSender: defaultWebhookSender
});
```

### Send to All Channels

```typescript
import { sendAllNotifications } from "langwatch/observability-sdk/alerts";

// Alert rule with multiple notification channels
const rule: AlertRule = {
  id: "alert-1",
  name: "High Error Rate",
  enabled: true,
  condition: {
    metric: "error_rate",
    operator: "gt",
    threshold: 5.0,
    timePeriod: 60
  },
  severity: "CRITICAL",
  notifications: [
    {
      channel: "email",
      recipients: ["team@example.com"]
    },
    {
      channel: "webhook",
      url: "https://hooks.slack.com/services/..."
    }
  ]
};

// Send to all configured channels in parallel
await sendAllNotifications(alertResult, {
  emailSender: myEmailSender,
  webhookSender: myWebhookSender
});
```

## Email Format

Email notifications include:

- **Alert severity** (INFO, WARNING, CRITICAL) with color coding
- **Alert name and description**
- **Current metric value** vs threshold
- **Timestamp** of the alert
- **Metadata** (team, service, etc.)
- **Alert ID** for reference

The email is formatted as responsive HTML with inline styles for maximum compatibility.

## Webhook Payload

Webhook notifications POST a JSON payload to the configured URL with the following structure:

```json
{
  "alert": {
    "id": "alert-123",
    "name": "High Error Rate Alert",
    "description": "Monitors error rate",
    "severity": "CRITICAL"
  },
  "condition": {
    "metric": "error_rate",
    "operator": "gt",
    "threshold": 5.0,
    "timePeriod": 60
  },
  "current": {
    "value": 7.5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "message": "Error rate is 7.50% (greater than 5.00%)",
  "metadata": {
    "team": "platform",
    "service": "claude-agent"
  }
}
```

### Custom Headers

You can include custom headers in webhook requests for authentication or other purposes:

```typescript
const webhookConfig = {
  channel: "webhook" as const,
  url: "https://api.example.com/alerts",
  headers: {
    "Authorization": "Bearer secret-token",
    "X-Alert-Source": "langwatch"
  }
};
```

### Default Webhook Sender

The module provides a default webhook sender using the Fetch API:

```typescript
import { defaultWebhookSender } from "langwatch/observability-sdk/alerts";

// Automatically handles:
// - JSON serialization
// - Content-Type header
// - Custom headers
// - Error handling for non-2xx responses
await defaultWebhookSender(url, payload, headers);
```

## Dependency Injection

The notification system uses dependency injection for email and webhook senders, making it easy to:

- **Test** with mock senders
- **Customize** email/webhook implementations
- **Integrate** with existing infrastructure

```typescript
// Example: Custom email sender
const myEmailSender: EmailSender = async (content) => {
  await myEmailService.send({
    to: content.to,
    subject: content.subject,
    html: content.html
  });
};

// Example: Custom webhook sender
const myWebhookSender: WebhookSender = async (url, payload, headers) => {
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });
};
```

## Error Handling

All notification functions propagate errors from the underlying senders. This allows you to:

- **Retry** failed notifications
- **Log** notification failures
- **Alert** on notification system issues

```typescript
try {
  await sendAllNotifications(result, dependencies);
} catch (error) {
  console.error("Failed to send notifications:", error);
  // Handle error (retry, log, etc.)
}
```

## Requirements

This implementation satisfies:

- **Requirement 19.4**: Email notification channel with alert details and metrics
- **Requirement 19.5**: Webhook notification channel with formatted payload and custom headers
