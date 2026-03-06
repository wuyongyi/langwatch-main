/**
 * Unit tests for alert triggering logic
 * 
 * Tests alert condition evaluation and triggering behavior
 * 
 * Requirements: 9.5, 10.5, 19.1, 19.2, 19.3
 */

import { describe, it, expect } from "vitest";
import type { AlertRule, MetricValues } from "../types";
import {
  evaluateCondition,
  evaluateAlertRule,
  evaluateAlertRules,
  getTriggeredAlerts,
  groupAlertsBySeverity,
} from "../trigger";

describe("given alert triggering logic", () => {
  describe("when evaluating error rate conditions", () => {
    it("triggers when error rate exceeds threshold with gt operator", () => {
      const condition = {
        metric: "error_rate" as const,
        operator: "gt" as const,
        threshold: 5.0,
        timePeriod: 60 as const,
      };

      const metrics: MetricValues = {
        errorRate: 7.5,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });

    it("does not trigger when error rate is below threshold with gt operator", () => {
      const condition = {
        metric: "error_rate" as const,
        operator: "gt" as const,
        threshold: 5.0,
        timePeriod: 60 as const,
      };

      const metrics: MetricValues = {
        errorRate: 3.0,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(false);
    });

    it("triggers when error rate equals threshold with gte operator", () => {
      const condition = {
        metric: "error_rate" as const,
        operator: "gte" as const,
        threshold: 5.0,
        timePeriod: 60 as const,
      };

      const metrics: MetricValues = {
        errorRate: 5.0,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });

    it("does not trigger when error rate metric is undefined", () => {
      const condition = {
        metric: "error_rate" as const,
        operator: "gt" as const,
        threshold: 5.0,
        timePeriod: 60 as const,
      };

      const metrics: MetricValues = {
        errorRate: undefined,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(false);
    });
  });

  describe("when evaluating latency conditions", () => {
    it("triggers when latency exceeds threshold with gt operator", () => {
      const condition = {
        metric: "latency" as const,
        operator: "gt" as const,
        threshold: 5000,
        timePeriod: 15 as const,
      };

      const metrics: MetricValues = {
        latency: 6500,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });

    it("does not trigger when latency is below threshold with gt operator", () => {
      const condition = {
        metric: "latency" as const,
        operator: "gt" as const,
        threshold: 5000,
        timePeriod: 15 as const,
      };

      const metrics: MetricValues = {
        latency: 3000,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(false);
    });

    it("triggers when latency is below threshold with lt operator", () => {
      const condition = {
        metric: "latency" as const,
        operator: "lt" as const,
        threshold: 1000,
        timePeriod: 15 as const,
      };

      const metrics: MetricValues = {
        latency: 500,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });
  });

  describe("when evaluating cost conditions", () => {
    it("triggers when cost exceeds threshold with gt operator", () => {
      const condition = {
        metric: "cost" as const,
        operator: "gt" as const,
        threshold: 100.0,
        timePeriod: 1440 as const,
      };

      const metrics: MetricValues = {
        cost: 150.0,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });

    it("does not trigger when cost is below threshold with gt operator", () => {
      const condition = {
        metric: "cost" as const,
        operator: "gt" as const,
        threshold: 100.0,
        timePeriod: 1440 as const,
      };

      const metrics: MetricValues = {
        cost: 75.0,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(false);
    });

    it("triggers when cost equals threshold with eq operator", () => {
      const condition = {
        metric: "cost" as const,
        operator: "eq" as const,
        threshold: 100.0,
        timePeriod: 1440 as const,
      };

      const metrics: MetricValues = {
        cost: 100.0,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });
  });

  describe("when evaluating alert rules", () => {
    it("returns triggered result when condition is met", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Error Rate",
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

      const metrics: MetricValues = {
        errorRate: 7.5,
        timestamp: new Date(),
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.triggered).toBe(true);
      expect(result.rule).toBe(rule);
      expect(result.currentValue).toBe(7.5);
      expect(result.threshold).toBe(5.0);
      expect(result.operator).toBe("gt");
      expect(result.message).toContain("High Error Rate");
      expect(result.message).toContain("triggered");
    });

    it("returns not triggered result when condition is not met", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Error Rate",
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

      const metrics: MetricValues = {
        errorRate: 3.0,
        timestamp: new Date(),
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.triggered).toBe(false);
      expect(result.currentValue).toBe(3.0);
      expect(result.message).toContain("not triggered");
    });

    it("returns not triggered result when rule is disabled", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Error Rate",
        enabled: false,
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

      const metrics: MetricValues = {
        errorRate: 7.5,
        timestamp: new Date(),
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.triggered).toBe(false);
      expect(result.message).toContain("disabled");
    });

    it("includes timestamp in result", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Error Rate",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "CRITICAL",
        notifications: [],
      };

      const timestamp = new Date("2024-01-01T12:00:00Z");
      const metrics: MetricValues = {
        errorRate: 7.5,
        timestamp,
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.timestamp).toBe(timestamp);
    });
  });

  describe("when evaluating multiple alert rules", () => {
    it("evaluates all rules and returns results", () => {
      const rules: AlertRule[] = [
        {
          id: "alert-1",
          name: "High Error Rate",
          enabled: true,
          condition: {
            metric: "error_rate",
            operator: "gt",
            threshold: 5.0,
            timePeriod: 60,
          },
          severity: "CRITICAL",
          notifications: [],
        },
        {
          id: "alert-2",
          name: "High Latency",
          enabled: true,
          condition: {
            metric: "latency",
            operator: "gt",
            threshold: 5000,
            timePeriod: 15,
          },
          severity: "WARNING",
          notifications: [],
        },
        {
          id: "alert-3",
          name: "High Cost",
          enabled: true,
          condition: {
            metric: "cost",
            operator: "gt",
            threshold: 100.0,
            timePeriod: 1440,
          },
          severity: "INFO",
          notifications: [],
        },
      ];

      const metrics: MetricValues = {
        errorRate: 7.5,
        latency: 3000,
        cost: 150.0,
        timestamp: new Date(),
      };

      const results = evaluateAlertRules(rules, metrics);

      expect(results).toHaveLength(3);
      expect(results[0]?.triggered).toBe(true); // Error rate alert
      expect(results[1]?.triggered).toBe(false); // Latency alert
      expect(results[2]?.triggered).toBe(true); // Cost alert
    });

    it("handles empty rules array", () => {
      const rules: AlertRule[] = [];
      const metrics: MetricValues = {
        errorRate: 7.5,
        timestamp: new Date(),
      };

      const results = evaluateAlertRules(rules, metrics);

      expect(results).toHaveLength(0);
    });
  });

  describe("when filtering triggered alerts", () => {
    it("returns only triggered alerts", () => {
      const results = [
        {
          triggered: true,
          rule: { id: "alert-1", severity: "CRITICAL" } as AlertRule,
          currentValue: 7.5,
          threshold: 5.0,
          operator: "gt",
          message: "Alert triggered",
          timestamp: new Date(),
        },
        {
          triggered: false,
          rule: { id: "alert-2", severity: "WARNING" } as AlertRule,
          currentValue: 3.0,
          threshold: 5.0,
          operator: "gt",
          message: "Alert not triggered",
          timestamp: new Date(),
        },
        {
          triggered: true,
          rule: { id: "alert-3", severity: "INFO" } as AlertRule,
          currentValue: 150.0,
          threshold: 100.0,
          operator: "gt",
          message: "Alert triggered",
          timestamp: new Date(),
        },
      ];

      const triggered = getTriggeredAlerts(results);

      expect(triggered).toHaveLength(2);
      expect(triggered[0]?.rule.id).toBe("alert-1");
      expect(triggered[1]?.rule.id).toBe("alert-3");
    });

    it("returns empty array when no alerts triggered", () => {
      const results = [
        {
          triggered: false,
          rule: { id: "alert-1", severity: "CRITICAL" } as AlertRule,
          currentValue: 3.0,
          threshold: 5.0,
          operator: "gt",
          message: "Alert not triggered",
          timestamp: new Date(),
        },
      ];

      const triggered = getTriggeredAlerts(results);

      expect(triggered).toHaveLength(0);
    });
  });

  describe("when grouping alerts by severity", () => {
    it("groups triggered alerts by severity level", () => {
      const results = [
        {
          triggered: true,
          rule: { id: "alert-1", severity: "CRITICAL" } as AlertRule,
          currentValue: 7.5,
          threshold: 5.0,
          operator: "gt",
          message: "Alert triggered",
          timestamp: new Date(),
        },
        {
          triggered: true,
          rule: { id: "alert-2", severity: "CRITICAL" } as AlertRule,
          currentValue: 8.0,
          threshold: 5.0,
          operator: "gt",
          message: "Alert triggered",
          timestamp: new Date(),
        },
        {
          triggered: false,
          rule: { id: "alert-3", severity: "WARNING" } as AlertRule,
          currentValue: 3.0,
          threshold: 5.0,
          operator: "gt",
          message: "Alert not triggered",
          timestamp: new Date(),
        },
        {
          triggered: true,
          rule: { id: "alert-4", severity: "INFO" } as AlertRule,
          currentValue: 150.0,
          threshold: 100.0,
          operator: "gt",
          message: "Alert triggered",
          timestamp: new Date(),
        },
      ];

      const grouped = groupAlertsBySeverity(results);

      expect(grouped.size).toBe(2);
      expect(grouped.get("CRITICAL")).toHaveLength(2);
      expect(grouped.get("INFO")).toHaveLength(1);
      expect(grouped.has("WARNING")).toBe(false); // Not triggered
    });

    it("returns empty map when no alerts triggered", () => {
      const results = [
        {
          triggered: false,
          rule: { id: "alert-1", severity: "CRITICAL" } as AlertRule,
          currentValue: 3.0,
          threshold: 5.0,
          operator: "gt",
          message: "Alert not triggered",
          timestamp: new Date(),
        },
      ];

      const grouped = groupAlertsBySeverity(results);

      expect(grouped.size).toBe(0);
    });
  });

  describe("when generating alert messages", () => {
    it("includes metric name, value, and threshold in message", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Error Rate",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "CRITICAL",
        notifications: [],
      };

      const metrics: MetricValues = {
        errorRate: 7.5,
        timestamp: new Date(),
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.message).toContain("High Error Rate");
      expect(result.message).toContain("7.50%");
      expect(result.message).toContain("5.00%");
    });

    it("formats latency values in milliseconds", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Latency",
        enabled: true,
        condition: {
          metric: "latency",
          operator: "gt",
          threshold: 5000,
          timePeriod: 15,
        },
        severity: "WARNING",
        notifications: [],
      };

      const metrics: MetricValues = {
        latency: 6500,
        timestamp: new Date(),
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.message).toContain("6500ms");
      expect(result.message).toContain("5000ms");
    });

    it("formats cost values in USD", () => {
      const rule: AlertRule = {
        id: "alert-1",
        name: "High Cost",
        enabled: true,
        condition: {
          metric: "cost",
          operator: "gt",
          threshold: 100.0,
          timePeriod: 1440,
        },
        severity: "INFO",
        notifications: [],
      };

      const metrics: MetricValues = {
        cost: 150.5,
        timestamp: new Date(),
      };

      const result = evaluateAlertRule(rule, metrics);

      expect(result.message).toContain("$150.50");
      expect(result.message).toContain("$100.00");
    });
  });

  describe("when handling edge cases", () => {
    it("handles zero threshold", () => {
      const condition = {
        metric: "error_rate" as const,
        operator: "gt" as const,
        threshold: 0,
        timePeriod: 60 as const,
      };

      const metrics: MetricValues = {
        errorRate: 0.1,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });

    it("handles zero metric value", () => {
      const condition = {
        metric: "error_rate" as const,
        operator: "gt" as const,
        threshold: 5.0,
        timePeriod: 60 as const,
      };

      const metrics: MetricValues = {
        errorRate: 0,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(false);
    });

    it("handles very large metric values", () => {
      const condition = {
        metric: "cost" as const,
        operator: "gt" as const,
        threshold: 1000000,
        timePeriod: 1440 as const,
      };

      const metrics: MetricValues = {
        cost: 2000000,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });

    it("handles negative metric values", () => {
      const condition = {
        metric: "latency" as const,
        operator: "lt" as const,
        threshold: 0,
        timePeriod: 15 as const,
      };

      const metrics: MetricValues = {
        latency: -100,
        timestamp: new Date(),
      };

      const result = evaluateCondition(condition, metrics);

      expect(result).toBe(true);
    });
  });
});
