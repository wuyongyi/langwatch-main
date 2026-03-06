# Alert Rule Configuration

This module provides types and functions for configuring threshold-based alerts for Claude Code agent monitoring.

## Features

- **Error Rate Alerts**: Monitor and alert on error rate thresholds
- **Latency Alerts**: Track performance and alert on latency thresholds
- **Cost Alerts**: Monitor API costs and alert when budgets are exceeded
- **Multiple Notification Channels**: Support for email and webhook notifications
- **Flexible Configuration**: Customizable thresholds, time periods, and severity levels

## Usage

### Creating an Error Rate Alert

```typescript
import { createAlertRule } from "langwatch/observability-sdk/alerts";

const errorRateAlert = createAlertRule({
  name: "High Error Rate Alert",
  description: "Alert when error rate exceeds 5% over 1 hour",
  enabled: true,
  condition: {
    metric: "error_rate",
    operator: "gt",
    threshold: 5.0, // 5% error rate
    timePeriod: 60, // Over 1 hour
  },
  severity: "CRITICAL",
  notifications: [
    {
      channel: "email",
      recipients: ["team@example.com", "oncall@example.com"],
    },
    {
      channel: "webhook",
      url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    },
  ],
  metadata: {
    team: "platform",
    service: "claude-agent",
  },
});

console.log(`Created alert rule: ${errorRateAlert.id}`);
```

### Creating a Latency Alert

```typescript
import { createAlertRule } from "langwatch/observability-sdk/alerts";

const latencyAlert = createAlertRule({
  name: "High Latency Alert",
  description: "Alert when p95 latency exceeds 5 seconds",
  enabled: true,
  condition: {
    metric: "latency",
    operator: "gt",
    threshold: 5000, // 5 seconds in milliseconds
    timePeriod: 15, // Over 15 minutes
    percentile: "p95", // Monitor 95th percentile
  },
  severity: "WARNING",
  notifications: [
    {
      channel: "email",
      recipients: ["performance-team@example.com"],
    },
  ],
});
```

### Creating a Cost Alert

```typescript
import { createAlertRule } from "langwatch/observability-sdk/alerts";

const costAlert = createAlertRule({
  name: "Daily Cost Budget Alert",
  description: "Alert when daily costs exceed $100",
  enabled: true,
  condition: {
    metric: "cost",
    operator: "gt",
    threshold: 100.0, // $100 USD
    timePeriod: 1440, // Over 1 day (1440 minutes)
  },
  severity: "WARNING",
  notifications: [
    {
      channel: "email",
      recipients: ["finance@example.com"],
    },
  ],
});
```

### Managing Alert Rules

```typescript
import {
  getAlertRule,
  getAllAlertRules,
  updateAlertRule,
  deleteAlertRule,
} from "langwatch/observability-sdk/alerts";

// Get a specific alert rule
const rule = getAlertRule("alert_123");

// Get all enabled alert rules
const enabledRules = getAllAlertRules({ enabled: true });

// Get all error rate alerts
const errorRateRules = getAllAlertRules({ metric: "error_rate" });

// Update an alert rule
const updated = updateAlertRule("alert_123", {
  enabled: false,
  condition: {
    metric: "error_rate",
    operator: "gt",
    threshold: 10.0, // Increase threshold to 10%
    timePeriod: 60,
  },
});

// Delete an alert rule
const deleted = deleteAlertRule("alert_123");
```

### Validating Alert Rules

```typescript
import { validateAlertRule } from "langwatch/observability-sdk/alerts";

const rule = {
  name: "Test Alert",
  enabled: true,
  condition: {
    metric: "error_rate",
    operator: "gt",
    threshold: 5.0,
    timePeriod: 60,
  },
  severity: "CRITICAL",
  notifications: [
    {
      channel: "email",
      recipients: ["team@example.com"],
    },
  ],
};

const errors = validateAlertRule(rule);
if (errors.length > 0) {
  console.error("Validation errors:", errors);
} else {
  console.log("Alert rule is valid");
}
```

## Alert Condition Types

### Error Rate Alert

Monitors the percentage of failed agent executions.

```typescript
interface ErrorRateAlertCondition {
  metric: "error_rate";
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number; // Percentage (0-100)
  timePeriod: 5 | 15 | 30 | 60 | 1440; // Minutes
}
```

### Latency Alert

Monitors agent execution latency at specified percentiles.

```typescript
interface LatencyAlertCondition {
  metric: "latency";
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number; // Milliseconds
  timePeriod: 5 | 15 | 30 | 60 | 1440; // Minutes
  percentile?: "p50" | "p95" | "p99" | "avg"; // Default: p95
}
```

### Cost Alert

Monitors total API costs.

```typescript
interface CostAlertCondition {
  metric: "cost";
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number; // USD
  timePeriod: 5 | 15 | 30 | 60 | 1440; // Minutes
}
```

## Notification Channels

### Email Notifications

```typescript
{
  channel: "email",
  recipients: ["user1@example.com", "user2@example.com"]
}
```

### Webhook Notifications

```typescript
{
  channel: "webhook",
  url: "https://your-webhook-endpoint.com/alerts",
  headers: {
    "Authorization": "Bearer YOUR_TOKEN",
    "X-Custom-Header": "value"
  }
}
```

## Alert Severity Levels

- **INFO**: Informational alerts for awareness
- **WARNING**: Warnings that require attention
- **CRITICAL**: Critical issues requiring immediate action

## Time Periods

Available time periods for metric aggregation:

- `5`: 5 minutes
- `15`: 15 minutes
- `30`: 30 minutes
- `60`: 1 hour
- `1440`: 1 day (24 hours)

## Comparison Operators

- `gt`: Greater than
- `gte`: Greater than or equal to
- `lt`: Less than
- `lte`: Less than or equal to
- `eq`: Equal to

## Best Practices

1. **Start with reasonable thresholds**: Begin with conservative thresholds and adjust based on actual metrics
2. **Use appropriate time periods**: Shorter periods for critical alerts, longer periods for cost monitoring
3. **Configure multiple notification channels**: Ensure alerts reach the right people through multiple channels
4. **Add metadata for organization**: Use metadata to tag alerts by team, service, or environment
5. **Validate before creating**: Always validate alert rules before creating them to catch configuration errors
6. **Monitor alert fatigue**: If alerts fire too frequently, adjust thresholds to reduce noise

## Alert Triggering

The alert triggering system evaluates alert rules against current metrics and triggers notifications when thresholds are exceeded.

### Evaluating Alert Rules

```typescript
import {
  evaluateAlertRule,
  evaluateAlertRules,
  getTriggeredAlerts,
  type MetricValues,
} from "langwatch/observability-sdk/alerts";

// Define current metric values
const metrics: MetricValues = {
  errorRate: 7.5, // 7.5% error rate
  latency: 6500, // 6500ms latency
  cost: 150.0, // $150 cost
  timestamp: new Date(),
};

// Evaluate a single alert rule
const result = evaluateAlertRule(errorRateAlert, metrics);

if (result.triggered) {
  console.log(`Alert triggered: ${result.message}`);
  console.log(`Current value: ${result.currentValue}`);
  console.log(`Threshold: ${result.threshold}`);
  console.log(`Severity: ${result.rule.severity}`);
}

// Evaluate multiple alert rules
const allRules = getAllAlertRules({ enabled: true });
const results = evaluateAlertRules(allRules, metrics);

// Get only triggered alerts
const triggeredAlerts = getTriggeredAlerts(results);
console.log(`${triggeredAlerts.length} alerts triggered`);
```

### Grouping Alerts by Severity

```typescript
import { groupAlertsBySeverity } from "langwatch/observability-sdk/alerts";

const results = evaluateAlertRules(allRules, metrics);
const grouped = groupAlertsBySeverity(results);

// Process critical alerts first
const criticalAlerts = grouped.get("CRITICAL") || [];
for (const alert of criticalAlerts) {
  console.log(`CRITICAL: ${alert.message}`);
  // Send immediate notifications
}

// Then warnings
const warningAlerts = grouped.get("WARNING") || [];
for (const alert of warningAlerts) {
  console.log(`WARNING: ${alert.message}`);
}
```

### Alert Trigger Result

When an alert rule is evaluated, it returns an `AlertTriggerResult`:

```typescript
interface AlertTriggerResult {
  triggered: boolean; // Whether the alert was triggered
  rule: AlertRule; // The alert rule that was evaluated
  currentValue: number; // Current metric value
  threshold: number; // Threshold that was compared against
  operator: string; // Comparison operator used
  message: string; // Human-readable message
  timestamp: Date; // When the evaluation occurred
}
```

### Integration with Monitoring Systems

The alert triggering system is designed to integrate with monitoring and analytics systems:

```typescript
import { getRealTimeDashboardService } from "langwatch/server/analytics";
import { getAllAlertRules, evaluateAlertRules } from "langwatch/observability-sdk/alerts";

async function checkAlerts(projectId: string) {
  const service = getRealTimeDashboardService();
  
  // Fetch current metrics
  const [errorRate, latency, cost] = await Promise.all([
    service.getCurrentErrorRate({ projectId }),
    service.getCurrentAverageLatency({ projectId }),
    // Cost calculation would be added here
  ]);
  
  // Prepare metrics for evaluation
  const metrics: MetricValues = {
    errorRate: errorRate.errorRate,
    latency: latency.averageLatency,
    cost: undefined, // Would be calculated from cost service
    timestamp: new Date(),
  };
  
  // Evaluate all enabled alert rules
  const rules = getAllAlertRules({ enabled: true });
  const results = evaluateAlertRules(rules, metrics);
  
  // Process triggered alerts
  const triggered = getTriggeredAlerts(results);
  for (const alert of triggered) {
    // Send notifications via configured channels
    await sendNotifications(alert);
  }
}
```

### Periodic Alert Evaluation

For production use, alert evaluation should run periodically:

```typescript
// Example: Check alerts every 5 minutes
setInterval(async () => {
  try {
    await checkAlerts(projectId);
  } catch (error) {
    console.error("Failed to check alerts:", error);
  }
}, 5 * 60 * 1000); // 5 minutes
```
