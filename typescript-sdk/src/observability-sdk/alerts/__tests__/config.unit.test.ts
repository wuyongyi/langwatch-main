/**
 * Unit tests for alert rule configuration
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createAlertRule,
  getAlertRule,
  getAllAlertRules,
  updateAlertRule,
  deleteAlertRule,
  clearAllAlertRules,
  validateAlertRule,
} from "../config";
import type { CreateAlertRuleInput } from "../types";

describe("given alert rule configuration", () => {
  beforeEach(() => {
    clearAllAlertRules();
  });

  describe("when creating an error rate alert rule", () => {
    it("creates a rule with generated ID and timestamps", () => {
      const input: CreateAlertRuleInput = {
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

      const rule = createAlertRule(input);

      expect(rule.id).toBeDefined();
      expect(rule.id).toMatch(/^alert_/);
      expect(rule.name).toBe("High Error Rate");
      expect(rule.enabled).toBe(true);
      expect(rule.condition.metric).toBe("error_rate");
      expect(rule.condition.threshold).toBe(5.0);
      expect(rule.severity).toBe("CRITICAL");
      expect(rule.createdAt).toBeDefined();
      expect(rule.updatedAt).toBeDefined();
      expect(rule.createdAt).toBe(rule.updatedAt);
    });

    it("stores the rule for retrieval", () => {
      const input: CreateAlertRuleInput = {
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

      const rule = createAlertRule(input);
      const retrieved = getAlertRule(rule.id);

      expect(retrieved).toEqual(rule);
    });
  });

  describe("when creating a latency alert rule", () => {
    it("creates a rule with latency-specific configuration", () => {
      const input: CreateAlertRuleInput = {
        name: "High Latency",
        enabled: true,
        condition: {
          metric: "latency",
          operator: "gt",
          threshold: 5000,
          timePeriod: 15,
          percentile: "p95",
        },
        severity: "WARNING",
        notifications: [
          {
            channel: "webhook",
            url: "https://hooks.slack.com/services/test",
          },
        ],
      };

      const rule = createAlertRule(input);

      expect(rule.condition.metric).toBe("latency");
      expect(rule.condition.threshold).toBe(5000);
      if (rule.condition.metric === "latency") {
        expect(rule.condition.percentile).toBe("p95");
      }
    });
  });

  describe("when creating a cost alert rule", () => {
    it("creates a rule with cost-specific configuration", () => {
      const input: CreateAlertRuleInput = {
        name: "High Cost",
        enabled: true,
        condition: {
          metric: "cost",
          operator: "gt",
          threshold: 100.0,
          timePeriod: 1440,
        },
        severity: "WARNING",
        notifications: [
          {
            channel: "email",
            recipients: ["finance@example.com"],
          },
        ],
      };

      const rule = createAlertRule(input);

      expect(rule.condition.metric).toBe("cost");
      expect(rule.condition.threshold).toBe(100.0);
      expect(rule.condition.timePeriod).toBe(1440);
    });
  });

  describe("when getting all alert rules", () => {
    it("returns all created rules", () => {
      createAlertRule({
        name: "Rule 1",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "CRITICAL",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      createAlertRule({
        name: "Rule 2",
        enabled: false,
        condition: {
          metric: "latency",
          operator: "gt",
          threshold: 1000,
          timePeriod: 30,
        },
        severity: "WARNING",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      const rules = getAllAlertRules();
      expect(rules).toHaveLength(2);
    });

    it("filters by enabled status", () => {
      createAlertRule({
        name: "Enabled Rule",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "CRITICAL",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      createAlertRule({
        name: "Disabled Rule",
        enabled: false,
        condition: {
          metric: "latency",
          operator: "gt",
          threshold: 1000,
          timePeriod: 30,
        },
        severity: "WARNING",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      const enabledRules = getAllAlertRules({ enabled: true });
      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0]?.name).toBe("Enabled Rule");
    });

    it("filters by metric type", () => {
      createAlertRule({
        name: "Error Rate Rule",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "CRITICAL",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      createAlertRule({
        name: "Latency Rule",
        enabled: true,
        condition: {
          metric: "latency",
          operator: "gt",
          threshold: 1000,
          timePeriod: 30,
        },
        severity: "WARNING",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      const errorRateRules = getAllAlertRules({ metric: "error_rate" });
      expect(errorRateRules).toHaveLength(1);
      expect(errorRateRules[0]?.condition.metric).toBe("error_rate");
    });
  });

  describe("when updating an alert rule", () => {
    it("updates the rule and preserves ID and createdAt", () => {
      const rule = createAlertRule({
        name: "Original Name",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "WARNING",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      const originalId = rule.id;
      const originalCreatedAt = rule.createdAt;

      // Wait a bit to ensure updatedAt changes
      const updated = updateAlertRule(rule.id, {
        name: "Updated Name",
        severity: "CRITICAL",
      });

      expect(updated).toBeDefined();
      expect(updated?.id).toBe(originalId);
      expect(updated?.createdAt).toBe(originalCreatedAt);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.severity).toBe("CRITICAL");
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalCreatedAt!);
    });

    it("returns undefined for non-existent rule", () => {
      const updated = updateAlertRule("non-existent-id", {
        name: "Updated Name",
      });

      expect(updated).toBeUndefined();
    });
  });

  describe("when deleting an alert rule", () => {
    it("removes the rule from storage", () => {
      const rule = createAlertRule({
        name: "To Delete",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        severity: "WARNING",
        notifications: [
          { channel: "email", recipients: ["test@example.com"] },
        ],
      });

      const deleted = deleteAlertRule(rule.id);
      expect(deleted).toBe(true);

      const retrieved = getAlertRule(rule.id);
      expect(retrieved).toBeUndefined();
    });

    it("returns false for non-existent rule", () => {
      const deleted = deleteAlertRule("non-existent-id");
      expect(deleted).toBe(false);
    });
  });

  describe("when validating an alert rule", () => {
    it("returns no errors for valid rule", () => {
      const input: CreateAlertRuleInput = {
        name: "Valid Rule",
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

      const errors = validateAlertRule(input);
      expect(errors).toHaveLength(0);
    });

    it("returns error for missing name", () => {
      const input: CreateAlertRuleInput = {
        name: "",
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

      const errors = validateAlertRule(input);
      expect(errors).toContain("Alert rule name is required");
    });

    it("returns error for negative threshold", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Threshold",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: -5.0,
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

      const errors = validateAlertRule(input);
      expect(errors).toContain("Threshold must be non-negative");
    });

    it("returns error for error rate threshold above 100", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Error Rate",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 150.0,
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

      const errors = validateAlertRule(input);
      expect(errors).toContain(
        "Error rate threshold must be between 0 and 100"
      );
    });

    it("returns error for invalid time period", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Time Period",
        enabled: true,
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 99 as any,
        },
        severity: "CRITICAL",
        notifications: [
          {
            channel: "email",
            recipients: ["team@example.com"],
          },
        ],
      };

      const errors = validateAlertRule(input);
      expect(errors.some((e) => e.includes("Time period must be one of"))).toBe(
        true
      );
    });

    it("returns error for missing notifications", () => {
      const input: CreateAlertRuleInput = {
        name: "No Notifications",
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

      const errors = validateAlertRule(input);
      expect(errors).toContain(
        "At least one notification channel is required"
      );
    });

    it("returns error for email notification without recipients", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Email",
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
            recipients: [],
          },
        ],
      };

      const errors = validateAlertRule(input);
      expect(
        errors.some((e) => e.includes("must have at least one recipient"))
      ).toBe(true);
    });

    it("returns error for invalid email address", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Email Format",
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
            recipients: ["not-an-email"],
          },
        ],
      };

      const errors = validateAlertRule(input);
      expect(errors.some((e) => e.includes("Invalid email address"))).toBe(
        true
      );
    });

    it("returns error for webhook notification without URL", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Webhook",
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
            channel: "webhook",
            url: "",
          },
        ],
      };

      const errors = validateAlertRule(input);
      expect(errors.some((e) => e.includes("must have a URL"))).toBe(true);
    });

    it("returns error for webhook URL without http protocol", () => {
      const input: CreateAlertRuleInput = {
        name: "Invalid Webhook URL",
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
            channel: "webhook",
            url: "not-a-url",
          },
        ],
      };

      const errors = validateAlertRule(input);
      expect(
        errors.some((e) => e.includes("must start with http:// or https://"))
      ).toBe(true);
    });
  });
});
