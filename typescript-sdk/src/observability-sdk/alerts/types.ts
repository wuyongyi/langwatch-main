/**
 * Alert rule configuration types for Claude Code Agent Integration
 * 
 * Supports threshold-based alerting for:
 * - Error rate monitoring
 * - Latency/performance monitoring
 * - Cost tracking
 */

/**
 * Metric types that can be monitored for alerts
 */
export type AlertMetricType = "error_rate" | "latency" | "cost";

/**
 * Comparison operators for threshold evaluation
 */
export type AlertOperator = "gt" | "gte" | "lt" | "lte" | "eq";

/**
 * Alert severity levels
 */
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

/**
 * Time period for metric aggregation (in minutes)
 */
export type AlertTimePeriod = 5 | 15 | 30 | 60 | 1440;

/**
 * Notification channel types
 */
export type NotificationChannel = "email" | "webhook";

/**
 * Base alert condition interface
 */
export interface AlertCondition {
  /**
   * The metric to monitor
   */
  metric: AlertMetricType;

  /**
   * Comparison operator
   */
  operator: AlertOperator;

  /**
   * Threshold value to compare against
   */
  threshold: number;

  /**
   * Time period for metric aggregation (in minutes)
   */
  timePeriod: AlertTimePeriod;
}

/**
 * Error rate alert condition
 * 
 * Triggers when error rate (percentage of failed executions) crosses threshold
 * 
 * @example
 * ```typescript
 * const condition: ErrorRateAlertCondition = {
 *   metric: "error_rate",
 *   operator: "gt",
 *   threshold: 5.0, // 5% error rate
 *   timePeriod: 60 // Over 1 hour
 * };
 * ```
 */
export interface ErrorRateAlertCondition extends AlertCondition {
  metric: "error_rate";
  /**
   * Threshold as percentage (0-100)
   */
  threshold: number;
}

/**
 * Latency alert condition
 * 
 * Triggers when latency (in milliseconds) crosses threshold
 * 
 * @example
 * ```typescript
 * const condition: LatencyAlertCondition = {
 *   metric: "latency",
 *   operator: "gt",
 *   threshold: 5000, // 5 seconds
 *   timePeriod: 15, // Over 15 minutes
 *   percentile: "p95" // 95th percentile latency
 * };
 * ```
 */
export interface LatencyAlertCondition extends AlertCondition {
  metric: "latency";
  /**
   * Threshold in milliseconds
   */
  threshold: number;
  /**
   * Latency percentile to monitor (default: p95)
   */
  percentile?: "p50" | "p95" | "p99" | "avg";
}

/**
 * Cost alert condition
 * 
 * Triggers when total cost crosses threshold
 * 
 * @example
 * ```typescript
 * const condition: CostAlertCondition = {
 *   metric: "cost",
 *   operator: "gt",
 *   threshold: 100.0, // $100
 *   timePeriod: 1440 // Over 1 day
 * };
 * ```
 */
export interface CostAlertCondition extends AlertCondition {
  metric: "cost";
  /**
   * Threshold in USD
   */
  threshold: number;
}

/**
 * Union type for all alert conditions
 */
export type AlertConditionType =
  | ErrorRateAlertCondition
  | LatencyAlertCondition
  | CostAlertCondition;

/**
 * Email notification configuration
 */
export interface EmailNotificationConfig {
  channel: "email";
  /**
   * Email addresses to notify
   */
  recipients: string[];
}

/**
 * Webhook notification configuration
 */
export interface WebhookNotificationConfig {
  channel: "webhook";
  /**
   * Webhook URL to POST alert data to
   */
  url: string;
  /**
   * Optional headers to include in webhook request
   */
  headers?: Record<string, string>;
}

/**
 * Union type for notification configurations
 */
export type NotificationConfig =
  | EmailNotificationConfig
  | WebhookNotificationConfig;

/**
 * Alert rule configuration
 * 
 * Defines when and how to trigger alerts based on metric thresholds
 * 
 * @example
 * ```typescript
 * const alertRule: AlertRule = {
 *   id: "high-error-rate-alert",
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
 *     },
 *     {
 *       channel: "webhook",
 *       url: "https://hooks.slack.com/services/..."
 *     }
 *   ],
 *   metadata: {
 *     team: "platform",
 *     service: "claude-agent"
 *   }
 * };
 * ```
 */
export interface AlertRule {
  /**
   * Unique identifier for the alert rule
   */
  id: string;

  /**
   * Human-readable name for the alert
   */
  name: string;

  /**
   * Description of what the alert monitors
   */
  description?: string;

  /**
   * Whether the alert rule is active
   */
  enabled: boolean;

  /**
   * Alert condition that triggers the alert
   */
  condition: AlertConditionType;

  /**
   * Alert severity level
   */
  severity: AlertSeverity;

  /**
   * Notification channels to use when alert triggers
   */
  notifications: NotificationConfig[];

  /**
   * Optional metadata for filtering and organization
   */
  metadata?: Record<string, string>;

  /**
   * Optional filter to apply alert only to specific traces
   * Uses same format as trace metadata filters
   */
  filters?: Record<string, string[]>;

  /**
   * Timestamp when the rule was created
   */
  createdAt?: number;

  /**
   * Timestamp when the rule was last updated
   */
  updatedAt?: number;
}

/**
 * Alert rule creation input (without generated fields)
 */
export type CreateAlertRuleInput = Omit<
  AlertRule,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Alert rule update input (partial updates allowed)
 */
export type UpdateAlertRuleInput = Partial<
  Omit<AlertRule, "id" | "createdAt" | "updatedAt">
>;

/**
 * Metric values for alert evaluation
 */
export interface MetricValues {
  /**
   * Error rate as percentage (0-100)
   */
  errorRate?: number;

  /**
   * Latency in milliseconds
   */
  latency?: number;

  /**
   * Cost in USD
   */
  cost?: number;

  /**
   * Timestamp when metrics were collected
   */
  timestamp: Date;
}

/**
 * Alert trigger result
 */
export interface AlertTriggerResult {
  /**
   * Whether the alert was triggered
   */
  triggered: boolean;

  /**
   * The alert rule that was evaluated
   */
  rule: AlertRule;

  /**
   * Current metric value that was evaluated
   */
  currentValue: number;

  /**
   * Threshold that was compared against
   */
  threshold: number;

  /**
   * Comparison operator used
   */
  operator: string;

  /**
   * Human-readable message describing the trigger
   */
  message: string;

  /**
   * Timestamp when the evaluation occurred
   */
  timestamp: Date;
}
