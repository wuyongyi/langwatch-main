/**
 * Unit tests for notification dispatcher
 * 
 * Tests routing of alert notifications to different channels
 */

import { describe, expect, it, vi } from "vitest";
import type { AlertTriggerResult } from "../../types";
import type { EmailSender } from "../email";
import type { WebhookSender } from "../webhook";
import {
  sendAllNotifications,
  sendNotification,
} from "../dispatcher";

describe("given an alert trigger result with notifications", () => {
  const baseResult: AlertTriggerResult = {
    triggered: true,
    rule: {
      id: "alert-123",
      name: "High Error Rate Alert",
      description: "Monitors error rate",
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
      },
    },
    currentValue: 7.5,
    threshold: 5.0,
    operator: "gt",
    message: "Error rate is 7.50% (greater than 5.00%)",
    timestamp: new Date("2024-01-15T10:30:00Z"),
  };

  describe("when sending email notification", () => {
    it("calls email sender with correct parameters", async () => {
      const mockEmailSender = vi.fn();
      const emailConfig = {
        channel: "email" as const,
        recipients: ["team@example.com"],
      };

      await sendNotification(baseResult, emailConfig, {
        emailSender: mockEmailSender,
      });

      expect(mockEmailSender).toHaveBeenCalledTimes(1);
      expect(mockEmailSender).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["team@example.com"],
          subject: expect.stringContaining("High Error Rate Alert"),
          html: expect.any(String),
        })
      );
    });

    it("throws error when email sender not configured", async () => {
      const emailConfig = {
        channel: "email" as const,
        recipients: ["team@example.com"],
      };

      await expect(
        sendNotification(baseResult, emailConfig, {})
      ).rejects.toThrow("Email sender not configured");
    });

    it("propagates email sender errors", async () => {
      const mockEmailSender = vi
        .fn()
        .mockRejectedValue(new Error("Email service down"));
      const emailConfig = {
        channel: "email" as const,
        recipients: ["team@example.com"],
      };

      await expect(
        sendNotification(baseResult, emailConfig, {
          emailSender: mockEmailSender,
        })
      ).rejects.toThrow("Email service down");
    });
  });

  describe("when sending webhook notification", () => {
    it("calls webhook sender with correct parameters", async () => {
      const mockWebhookSender = vi.fn();
      const webhookConfig = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
        headers: {
          "X-Custom-Header": "value",
        },
      };

      await sendNotification(baseResult, webhookConfig, {
        webhookSender: mockWebhookSender,
      });

      expect(mockWebhookSender).toHaveBeenCalledTimes(1);
      expect(mockWebhookSender).toHaveBeenCalledWith(
        "https://hooks.example.com/alert",
        expect.objectContaining({
          alert: expect.objectContaining({
            id: "alert-123",
            name: "High Error Rate Alert",
            severity: "CRITICAL",
          }),
          condition: expect.objectContaining({
            metric: "error_rate",
            operator: "gt",
            threshold: 5.0,
          }),
          current: expect.objectContaining({
            value: 7.5,
          }),
          message: "Error rate is 7.50% (greater than 5.00%)",
        }),
        { "X-Custom-Header": "value" }
      );
    });

    it("includes timestamp in ISO format", async () => {
      const mockWebhookSender = vi.fn();
      const webhookConfig = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await sendNotification(baseResult, webhookConfig, {
        webhookSender: mockWebhookSender,
      });

      const payload = mockWebhookSender.mock.calls[0]?.[1] as any;
      expect(payload.current.timestamp).toBe("2024-01-15T10:30:00.000Z");
    });

    it("includes metadata in payload", async () => {
      const mockWebhookSender = vi.fn();
      const webhookConfig = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await sendNotification(baseResult, webhookConfig, {
        webhookSender: mockWebhookSender,
      });

      const payload = mockWebhookSender.mock.calls[0]?.[1] as any;
      expect(payload.metadata).toEqual({ team: "platform" });
    });

    it("throws error when webhook sender not configured", async () => {
      const webhookConfig = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await expect(
        sendNotification(baseResult, webhookConfig, {})
      ).rejects.toThrow("Webhook sender not configured");
    });

    it("propagates webhook sender errors", async () => {
      const mockWebhookSender = vi
        .fn()
        .mockRejectedValue(new Error("Webhook endpoint unavailable"));
      const webhookConfig = {
        channel: "webhook" as const,
        url: "https://hooks.example.com/alert",
      };

      await expect(
        sendNotification(baseResult, webhookConfig, {
          webhookSender: mockWebhookSender,
        })
      ).rejects.toThrow("Webhook endpoint unavailable");
    });
  });

  describe("when sending to unknown channel", () => {
    it("throws error for unknown channel type", async () => {
      const unknownConfig = {
        channel: "sms" as any,
        url: "https://example.com", // Add required field to satisfy type
      };

      await expect(
        sendNotification(baseResult, unknownConfig, {})
      ).rejects.toThrow("Unknown notification channel: sms");
    });
  });

  describe("when sending to multiple notification channels", () => {
    it("sends to all configured channels", async () => {
      const mockEmailSender = vi.fn();
      const mockWebhookSender = vi.fn();

      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          notifications: [
            {
              channel: "email",
              recipients: ["team@example.com"],
            },
            {
              channel: "webhook",
              url: "https://hooks.example.com/alert",
            },
          ],
        },
      };

      await sendAllNotifications(result, {
        emailSender: mockEmailSender,
        webhookSender: mockWebhookSender,
      });

      expect(mockEmailSender).toHaveBeenCalledTimes(1);
      expect(mockWebhookSender).toHaveBeenCalledTimes(1);
    });

    it("sends notifications in parallel", async () => {
      const emailDelay = 100;
      const webhookDelay = 100;

      const mockEmailSender: EmailSender = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, emailDelay))
        );

      const mockWebhookSender: WebhookSender = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, webhookDelay))
        );

      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          notifications: [
            {
              channel: "email",
              recipients: ["team@example.com"],
            },
            {
              channel: "webhook",
              url: "https://hooks.example.com/alert",
            },
          ],
        },
      };

      const startTime = Date.now();
      await sendAllNotifications(result, {
        emailSender: mockEmailSender,
        webhookSender: mockWebhookSender,
      });
      const duration = Date.now() - startTime;

      // If parallel, duration should be ~100ms (max of both)
      // If sequential, duration would be ~200ms (sum of both)
      expect(duration).toBeLessThan(150);
    });

    it("handles empty notifications array", async () => {
      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          notifications: [],
        },
      };

      await expect(sendAllNotifications(result, {})).resolves.not.toThrow();
    });

    it("fails if any notification fails", async () => {
      const mockEmailSender = vi
        .fn()
        .mockRejectedValue(new Error("Email failed"));
      const mockWebhookSender = vi.fn();

      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          notifications: [
            {
              channel: "email",
              recipients: ["team@example.com"],
            },
            {
              channel: "webhook",
              url: "https://hooks.example.com/alert",
            },
          ],
        },
      };

      await expect(
        sendAllNotifications(result, {
          emailSender: mockEmailSender,
          webhookSender: mockWebhookSender,
        })
      ).rejects.toThrow("Email failed");
    });
  });

  describe("when sending to multiple email recipients", () => {
    it("sends single email to all recipients", async () => {
      const mockEmailSender = vi.fn();

      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          notifications: [
            {
              channel: "email",
              recipients: ["team@example.com", "oncall@example.com"],
            },
          ],
        },
      };

      await sendAllNotifications(result, {
        emailSender: mockEmailSender,
      });

      expect(mockEmailSender).toHaveBeenCalledTimes(1);
      expect(mockEmailSender).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["team@example.com", "oncall@example.com"],
        })
      );
    });
  });
});
