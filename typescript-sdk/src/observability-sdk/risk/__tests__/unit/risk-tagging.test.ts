import { describe, it, expect, vi } from "vitest";
import { validateRiskLevel, tagSpanWithRisk } from "../../risk-tagging";
import { trace } from "@opentelemetry/api";

describe("Risk Tagging", () => {
  describe("validateRiskLevel", () => {
    describe("when validating valid risk levels", () => {
      it("accepts low as valid", () => {
        expect(() => validateRiskLevel("low")).not.toThrow();
      });

      it("accepts medium as valid", () => {
        expect(() => validateRiskLevel("medium")).not.toThrow();
      });

      it("accepts high as valid", () => {
        expect(() => validateRiskLevel("high")).not.toThrow();
      });
    });

    describe("when validating invalid risk levels", () => {
      it("rejects critical as invalid", () => {
        expect(() => validateRiskLevel("critical" as any)).toThrow(
          "Invalid risk level"
        );
      });

      it("rejects empty string as invalid", () => {
        expect(() => validateRiskLevel("" as any)).toThrow(
          "Invalid risk level"
        );
      });

      it("rejects undefined as invalid", () => {
        expect(() => validateRiskLevel(undefined as any)).toThrow(
          "Invalid risk level"
        );
      });
    });
  });

  describe("tagSpanWithRisk", () => {
    describe("when tagging a span with risk level only", () => {
      it("sets the langwatch.risk.level attribute", () => {
        const tracer = trace.getTracer("test");
        const span = tracer.startSpan("test-operation");
        const mockSetAttribute = vi.fn();
        span.setAttribute = mockSetAttribute;

        tagSpanWithRisk(span, { level: "high" });

        expect(mockSetAttribute).toHaveBeenCalledWith(
          "langwatch.risk.level",
          "high"
        );
      });
    });

    describe("when tagging a span with risk level and reason", () => {
      it("sets both langwatch.risk.level and langwatch.risk.reason attributes", () => {
        const tracer = trace.getTracer("test");
        const span = tracer.startSpan("test-operation");
        const mockSetAttribute = vi.fn();
        span.setAttribute = mockSetAttribute;

        tagSpanWithRisk(span, {
          level: "high",
          reason: "Modifying production database",
        });

        expect(mockSetAttribute).toHaveBeenCalledWith(
          "langwatch.risk.level",
          "high"
        );
        expect(mockSetAttribute).toHaveBeenCalledWith(
          "langwatch.risk.reason",
          "Modifying production database"
        );
      });
    });

    describe("when tagging with invalid risk level", () => {
      it("throws an error", () => {
        const tracer = trace.getTracer("test");
        const span = tracer.startSpan("test-operation");

        expect(() =>
          tagSpanWithRisk(span, { level: "critical" as any })
        ).toThrow("Invalid risk level");
      });
    });
  });
});
