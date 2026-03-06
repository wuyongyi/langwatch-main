import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRecordEvaluation } from "../record-evaluation.js";

// Mock the config module
vi.mock("../../config.js", () => ({
  getConfig: () => ({
    apiKey: "test-api-key",
    endpoint: "https://test.langwatch.ai",
  }),
}));

// Mock OpenTelemetry modules
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn((spans, callback) => callback({ code: 0 })),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("given record_evaluation MCP tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when recording evaluation with all parameters", () => {
    it("returns success message", async () => {
      const result = await handleRecordEvaluation({
        trace_id: "trace-abc-123",
        evaluator_name: "code-correctness",
        passed: true,
        score: 0.95,
        details: "Code compiles successfully",
      });

      const parsed = JSON.parse(result);
      expect(parsed.message).toContain("successfully");
      expect(parsed.evaluator).toBe("code-correctness");
      expect(parsed.passed).toBe(true);
      expect(parsed.trace_id).toBe("trace-abc-123");
    });
  });

  describe("when recording failed evaluation", () => {
    it("records evaluation with passed=false", async () => {
      const result = await handleRecordEvaluation({
        trace_id: "trace-xyz-789",
        evaluator_name: "response-accuracy",
        passed: false,
        score: 0.3,
        details: "Response contains hallucinations",
      });

      const parsed = JSON.parse(result);
      expect(parsed.passed).toBe(false);
      expect(parsed.evaluator).toBe("response-accuracy");
    });
  });

  describe("when recording evaluation without optional fields", () => {
    it("accepts minimal parameters", async () => {
      const result = await handleRecordEvaluation({
        trace_id: "trace-minimal",
        evaluator_name: "basic-check",
        passed: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.message).toContain("successfully");
      expect(parsed.passed).toBe(true);
    });
  });

  describe("when recording evaluation with score only", () => {
    it("includes score without details", async () => {
      const result = await handleRecordEvaluation({
        trace_id: "trace-score-only",
        evaluator_name: "quality-score",
        passed: true,
        score: 0.85,
      });

      const parsed = JSON.parse(result);
      expect(parsed.message).toContain("successfully");
    });
  });

  describe("when recording evaluation with details only", () => {
    it("includes details without score", async () => {
      const result = await handleRecordEvaluation({
        trace_id: "trace-details-only",
        evaluator_name: "manual-review",
        passed: false,
        details: "Needs improvement in error handling",
      });

      const parsed = JSON.parse(result);
      expect(parsed.message).toContain("successfully");
      expect(parsed.passed).toBe(false);
    });
  });
});
