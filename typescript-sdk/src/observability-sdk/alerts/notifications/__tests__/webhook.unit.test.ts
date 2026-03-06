/**
 * Unit tests for webhook notification handler
 */

import { describe, it, expect, vi } from "vitest";
import {
  formatAlertWebhookPayload,
  sendAlertWebhook,
  type AlertWebhookPayload,
  type WebhookSender,
} from "../webhook";
import type { AlertTriggerResult } from "../../types";

describe("given webhook notification handler", () => {
  describe("when formatting alert webhook payload", () => {
    it("includes all required alert fields", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Error rate is 7.50% (greater than 5.00%)",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.alert.id).toBe("alert-1");
      expect(payload.alert.name).toBe("High Error Rate");
      expect(payload.alert.severity).toBe("CRITICAL");
    });

    it("includes condition details", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
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
        },
        currentValue: 6500,
        threshold: 5000,
        operator: "gt",
        message: "Latency is 6500ms (greater than 5000ms)",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.condition.metric).toBe("latency");
      expect(payload.condition.operator).toBe("gt");
      expect(payload.condition.threshold).toBe(5000);
      expect(payload.condition.timePeriod).toBe(15);
    });

    it("includes current value and timestamp", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z");
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
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
        },
        currentValue: 125.5,
        threshold: 100.0,
        operator: "gt",
        message: "Cost is $125.50 (greater than $100.00)",
        timestamp,
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.current.value).toBe(125.5);
      expect(payload.current.timestamp).toBe(timestamp.toISOString());
    });

    it("includes message", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Custom alert message",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.message).toBe("Custom alert message");
    });

    it("includes optional description when provided", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
          description: "This is a test alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.alert.description).toBe("This is a test alert");
    });

    it("includes optional metadata when provided", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
          enabled: true,
          condition: {
            metric: "error_rate",
            operator: "gt",
            threshold: 5.0,
            timePeriod: 60,
          },
          severity: "CRITICAL",
          notifications: [],
          metadata: {
            team: "platform",
            service: "claude-agent",
          },
        },
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.metadata).toEqual({
        team: "platform",
        service: "claude-agent",
      });
    });

    it("omits description when not provided", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.alert.description).toBeUndefined();
    });

    it("omits metadata when not provided", () => {
      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const payload = formatAlertWebhookPayload(result);

      expect(payload.metadata).toBeUndefined();
    });
  });

  describe("when sending alert webhook", () => {
    it("calls webhook sender with correct URL", async () => {
      const mockWebhookSender = vi.fn<WebhookSender>().mockResolvedValue();

      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const config = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await sendAlertWebhook(result, config, mockWebhookSender);

      expect(mockWebhookSender).toHaveBeenCalledWith(
        "https://hooks.example.com/alert",
        expect.any(Object),
        undefined
      );
    });

    it("calls webhook sender with formatted payload", async () => {
      const mockWebhookSender = vi.fn<WebhookSender>().mockResolvedValue();

      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Error rate is 7.50% (greater than 5.00%)",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const config = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await sendAlertWebhook(result, config, mockWebhookSender);

      const expectedPayload: AlertWebhookPayload = {
        alert: {
          id: "alert-1",
          name: "High Error Rate",
          severity: "CRITICAL",
        },
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5.0,
          timePeriod: 60,
        },
        current: {
          value: 7.5,
          timestamp: "2024-01-15T10:30:00.000Z",
        },
        message: "Error rate is 7.50% (greater than 5.00%)",
      };

      expect(mockWebhookSender).toHaveBeenCalledWith(
        "https://hooks.example.com/alert",
        expectedPayload,
        undefined
      );
    });

    it("passes custom headers to webhook sender", async () => {
      const mockWebhookSender = vi.fn<WebhookSender>().mockResolvedValue();

      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const config = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
        headers: {
          Authorization: "Bearer token123",
          "X-Custom-Header": "custom-value",
        },
      };

      await sendAlertWebhook(result, config, mockWebhookSender);

      expect(mockWebhookSender).toHaveBeenCalledWith(
        "https://hooks.example.com/alert",
        expect.any(Object),
        {
          Authorization: "Bearer token123",
          "X-Custom-Header": "custom-value",
        }
      );
    });

    it("propagates errors from webhook sender", async () => {
      const mockWebhookSender = vi
        .fn<WebhookSender>()
        .mockRejectedValue(new Error("Network error"));

      const result: AlertTriggerResult = {
        triggered: true,
        rule: {
          id: "alert-1",
          name: "Test Alert",
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
        currentValue: 7.5,
        threshold: 5.0,
        operator: "gt",
        message: "Alert triggered",
        timestamp: new Date("2024-01-15T10:30:00Z"),
      };

      const config = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await expect(
        sendAlertWebhook(result, config, mockWebhookSender)
      ).rejects.toThrow("Network error");
    });
  });
});
