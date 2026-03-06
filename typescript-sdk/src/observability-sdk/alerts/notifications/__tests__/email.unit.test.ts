/**
 * Unit tests for email notification handler
 * 
 * Tests email content generation and sending for alert notifications
 */

import { describe, expect, it, vi } from "vitest";
import type {
  AlertTriggerResult,
  EmailNotificationConfig,
} from "../../types";
import {
  createAlertEmailContent,
  sendAlertEmail,
  type AlertEmailContent,
  type EmailSender,
} from "../email";

describe("given an alert trigger result", () => {
  const baseResult: AlertTriggerResult = {
    triggered: true,
    rule: {
      id: "alert-123",
      name: "High Error Rate Alert",
      description: "Monitors error rate for critical operations",
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
    message: "Error rate is 7.50% (greater than 5.00%)",
    timestamp: new Date("2024-01-15T10:30:00Z"),
  };

  const emailConfig: EmailNotificationConfig = {
    channel: "email",
    recipients: ["team@example.com", "oncall@example.com"],
  };

  describe("when creating email content", () => {
    it("includes all recipients from config", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.to).toEqual(["team@example.com", "oncall@example.com"]);
    });

    it("includes severity in subject line", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.subject).toContain("CRITICAL");
      expect(content.subject).toContain("High Error Rate Alert");
    });

    it("includes alert name in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("High Error Rate Alert");
    });

    it("includes alert description in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain(
        "Monitors error rate for critical operations"
      );
    });

    it("includes current value in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("7.50%");
    });

    it("includes threshold in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("5.00%");
    });

    it("includes alert message in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain(
        "Error rate is 7.50% (greater than 5.00%)"
      );
    });

    it("includes metadata in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("platform");
      expect(content.html).toContain("claude-agent");
    });

    it("includes alert ID in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("alert-123");
    });

    it("includes timestamp in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("1/15/2024");
    });

    it("includes time period in HTML body", () => {
      const content = createAlertEmailContent(baseResult, emailConfig);

      expect(content.html).toContain("60 minutes");
    });
  });

  describe("when creating email content for different severities", () => {
    it("formats INFO severity correctly", () => {
      const result = {
        ...baseResult,
        rule: { ...baseResult.rule, severity: "INFO" as const },
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.subject).toContain("[INFO]");
      expect(content.html).toContain("INFO");
    });

    it("formats WARNING severity correctly", () => {
      const result = {
        ...baseResult,
        rule: { ...baseResult.rule, severity: "WARNING" as const },
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.subject).toContain("[WARNING]");
      expect(content.html).toContain("WARNING");
    });

    it("formats CRITICAL severity correctly", () => {
      const result = {
        ...baseResult,
        rule: { ...baseResult.rule, severity: "CRITICAL" as const },
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.subject).toContain("[CRITICAL]");
      expect(content.html).toContain("CRITICAL");
    });
  });

  describe("when creating email content for different metric types", () => {
    it("formats error rate metric correctly", () => {
      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          condition: {
            metric: "error_rate",
            operator: "gt",
            threshold: 5.0,
            timePeriod: 60,
          },
        },
        currentValue: 7.5,
        threshold: 5.0,
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("Error Rate");
      expect(content.html).toContain("7.50%");
      expect(content.html).toContain("5.00%");
    });

    it("formats latency metric correctly", () => {
      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          condition: {
            metric: "latency",
            operator: "gt",
            threshold: 5000,
            timePeriod: 15,
          },
        },
        currentValue: 7500,
        threshold: 5000,
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("Latency");
      expect(content.html).toContain("7500ms");
      expect(content.html).toContain("5000ms");
    });

    it("formats cost metric correctly", () => {
      const result: AlertTriggerResult = {
        ...baseResult,
        rule: {
          ...baseResult.rule,
          condition: {
            metric: "cost",
            operator: "gt",
            threshold: 100.0,
            timePeriod: 1440,
          },
        },
        currentValue: 150.5,
        threshold: 100.0,
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("Cost");
      expect(content.html).toContain("$150.50");
      expect(content.html).toContain("$100.00");
    });
  });

  describe("when creating email content without optional fields", () => {
    it("handles missing description gracefully", () => {
      const result = {
        ...baseResult,
        rule: { ...baseResult.rule, description: undefined },
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("High Error Rate Alert");
      expect(content.html).not.toContain("undefined");
    });

    it("handles missing metadata gracefully", () => {
      const result = {
        ...baseResult,
        rule: { ...baseResult.rule, metadata: undefined },
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("High Error Rate Alert");
      expect(content.html).not.toContain("Additional Context");
    });

    it("handles empty metadata gracefully", () => {
      const result = {
        ...baseResult,
        rule: { ...baseResult.rule, metadata: {} },
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("High Error Rate Alert");
      expect(content.html).not.toContain("Additional Context");
    });
  });

  describe("when sending alert email", () => {
    it("calls email sender with correct content", async () => {
      const mockEmailSender = vi.fn();

      await sendAlertEmail(baseResult, emailConfig, mockEmailSender);

      expect(mockEmailSender).toHaveBeenCalledTimes(1);
      expect(mockEmailSender).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["team@example.com", "oncall@example.com"],
          subject: expect.stringContaining("CRITICAL"),
          html: expect.stringContaining("High Error Rate Alert"),
        })
      );
    });

    it("propagates email sender errors", async () => {
      const mockEmailSender = vi
        .fn()
        .mockRejectedValue(new Error("Email service unavailable"));

      await expect(
        sendAlertEmail(baseResult, emailConfig, mockEmailSender)
      ).rejects.toThrow("Email service unavailable");
    });

    it("sends email with all required details", async () => {
      const mockEmailSender = vi.fn();

      await sendAlertEmail(baseResult, emailConfig, mockEmailSender);

      const sentContent = mockEmailSender.mock.calls[0]?.[0] as AlertEmailContent;
      expect(sentContent).toBeDefined();
      expect(sentContent.to).toEqual([
        "team@example.com",
        "oncall@example.com",
      ]);
      expect(sentContent.subject).toContain("High Error Rate Alert");
      expect(sentContent.html).toContain("7.50%");
      expect(sentContent.html).toContain("5.00%");
      expect(sentContent.html).toContain("alert-123");
    });
  });

  describe("when creating email content for single recipient", () => {
    it("handles single recipient correctly", () => {
      const singleRecipientConfig: EmailNotificationConfig = {
        channel: "email",
        recipients: ["admin@example.com"],
      };

      const content = createAlertEmailContent(
        baseResult,
        singleRecipientConfig
      );

      expect(content.to).toEqual(["admin@example.com"]);
    });
  });

  describe("when creating email content with different operators", () => {
    it("formats greater than operator correctly", () => {
      const result = {
        ...baseResult,
        operator: "gt",
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("gt");
    });

    it("formats less than operator correctly", () => {
      const result = {
        ...baseResult,
        operator: "lt",
      };

      const content = createAlertEmailContent(result, emailConfig);

      expect(content.html).toContain("lt");
    });
  });
});
