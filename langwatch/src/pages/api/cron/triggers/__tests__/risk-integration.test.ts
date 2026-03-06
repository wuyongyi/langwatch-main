import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyRiskBasedPriority } from "../risk-integration";
import type { Trigger } from "@prisma/client";
import type { TriggerData } from "../types";
import { AlertType } from "@prisma/client";

describe("Risk Integration", () => {
  describe("applyRiskBasedPriority", () => {
    let mockTrigger: Trigger;
    let mockTriggerData: TriggerData[];

    beforeEach(() => {
      mockTrigger = {
        id: "trigger-1",
        name: "Test Trigger",
        projectId: "project-1",
        action: "SEND_EMAIL" as any,
        actionParams: {},
        filters: "{}",
        lastRunAt: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        active: true,
        message: null,
        deleted: false,
        alertType: null,
        customGraphId: null,
      } as Trigger;
    });

    describe("given trigger data with mixed risk levels", () => {
      beforeEach(() => {
        mockTriggerData = [
          {
            input: "test input 1",
            output: "test output 1",
            traceId: "trace-1",
            projectId: "project-1",
            fullTrace: {
              trace_id: "trace-1",
              project_id: "project-1",
              metadata: {
                "langwatch.risk.level": "high",
              },
              error: {
                has_error: true,
                message: "Critical failure",
                stacktrace: [],
              },
              timestamps: {
                started_at: Date.now(),
                inserted_at: Date.now(),
                updated_at: Date.now(),
              },
              spans: [],
            } as any,
          },
          {
            input: "test input 2",
            output: "test output 2",
            traceId: "trace-2",
            projectId: "project-1",
            fullTrace: {
              trace_id: "trace-2",
              project_id: "project-1",
              metadata: {
                "langwatch.risk.level": "low",
              },
              error: null,
              timestamps: {
                started_at: Date.now(),
                inserted_at: Date.now(),
                updated_at: Date.now(),
              },
              spans: [],
            } as any,
          },
        ];
      });

      describe("when trigger has no explicit alertType", () => {
        it("sets alertType to highest priority from traces", () => {
          const result = applyRiskBasedPriority({
            trigger: mockTrigger,
            triggerData: mockTriggerData,
          });

          expect(result.alertType).toBe(AlertType.CRITICAL);
        });

        it("includes risk level in trigger data", () => {
          const result = applyRiskBasedPriority({
            trigger: mockTrigger,
            triggerData: mockTriggerData,
          });

          expect(result.triggerData[0].riskLevel).toBe("high");
          expect(result.triggerData[1].riskLevel).toBe("low");
        });
      });

      describe("when trigger has explicit alertType", () => {
        beforeEach(() => {
          mockTrigger.alertType = AlertType.INFO;
        });

        it("preserves the explicit alertType", () => {
          const result = applyRiskBasedPriority({
            trigger: mockTrigger,
            triggerData: mockTriggerData,
          });

          expect(result.alertType).toBe(AlertType.INFO);
        });

        it("still includes risk level in trigger data", () => {
          const result = applyRiskBasedPriority({
            trigger: mockTrigger,
            triggerData: mockTriggerData,
          });

          expect(result.triggerData[0].riskLevel).toBe("high");
          expect(result.triggerData[1].riskLevel).toBe("low");
        });
      });
    });

    describe("given trigger data with no risk levels", () => {
      beforeEach(() => {
        mockTriggerData = [
          {
            input: "test input",
            output: "test output",
            traceId: "trace-1",
            projectId: "project-1",
            fullTrace: {
              trace_id: "trace-1",
              project_id: "project-1",
              metadata: {},
              error: {
                has_error: true,
                message: "Error",
                stacktrace: [],
              },
              timestamps: {
                started_at: Date.now(),
                inserted_at: Date.now(),
                updated_at: Date.now(),
              },
              spans: [],
            } as any,
          },
        ];
      });

      describe("when trigger has no explicit alertType", () => {
        it("sets alertType to WARNING for errors", () => {
          const result = applyRiskBasedPriority({
            trigger: mockTrigger,
            triggerData: mockTriggerData,
          });

          expect(result.alertType).toBe(AlertType.WARNING);
        });

        it("sets riskLevel to undefined when not present", () => {
          const result = applyRiskBasedPriority({
            trigger: mockTrigger,
            triggerData: mockTriggerData,
          });

          expect(result.triggerData[0].riskLevel).toBeUndefined();
        });
      });
    });

    describe("given empty trigger data", () => {
      beforeEach(() => {
        mockTriggerData = [];
      });

      it("returns trigger with no alertType change", () => {
        const result = applyRiskBasedPriority({
          trigger: mockTrigger,
          triggerData: mockTriggerData,
        });

        expect(result.alertType).toBeNull();
      });
    });
  });
});
