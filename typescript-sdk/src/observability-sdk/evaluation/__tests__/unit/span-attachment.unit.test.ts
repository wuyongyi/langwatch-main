/**
 * Unit tests for evaluation result attachment to spans.
 * 
 * Feature: claude-code-agent-integration
 * Tests attaching evaluation results to spans for display in traces.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { attachEvaluationResults } from "../../span-attachment";
import type { EvaluatorExecutionResult } from "../../executor";
import type { LangWatchSpan } from "../../../span/types";
import { ATTR_LANGWATCH_EVALUATION_CUSTOM } from "../../../semconv/attributes";

describe("given evaluation result attachment", () => {
  let mockSpan: LangWatchSpan;

  beforeEach(() => {
    mockSpan = {
      setAttribute: vi.fn(),
      setAttributes: vi.fn(),
      addEvent: vi.fn(),
      recordException: vi.fn(),
      setStatus: vi.fn(),
      updateName: vi.fn(),
      end: vi.fn(),
      isRecording: vi.fn().mockReturnValue(true),
      spanContext: vi.fn(),
      addLink: vi.fn(),
      addLinks: vi.fn(),
      setType: vi.fn(),
      setSelectedPrompt: vi.fn(),
      setRequestModel: vi.fn(),
      setResponseModel: vi.fn(),
      setRAGContexts: vi.fn(),
      setRAGContext: vi.fn(),
      setMetrics: vi.fn(),
      setInput: vi.fn(),
      setOutput: vi.fn(),
      setMetadata: vi.fn(),
      setMetadataBatch: vi.fn(),
    } as any;
  });

  describe("when attaching evaluation results to a span", () => {
    it("attaches results as JSON attribute", () => {
      const results: EvaluatorExecutionResult[] = [
        {
          evaluator_name: "test-evaluator",
          status: "processed",
          passed: true,
          score: 0.95,
          details: "Test passed",
        },
      ];

      attachEvaluationResults(mockSpan, results);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        ATTR_LANGWATCH_EVALUATION_CUSTOM,
        expect.stringContaining('"evaluator_name":"test-evaluator"')
      );
    });

    it("includes all evaluation result fields", () => {
      const results: EvaluatorExecutionResult[] = [
        {
          evaluator_name: "code-correctness",
          status: "processed",
          passed: true,
          score: 0.9,
          details: "Code is syntactically valid",
          metadata: { language: "python" },
        },
      ];

      attachEvaluationResults(mockSpan, results);

      const call = (mockSpan.setAttribute as any).mock.calls[0];
      const jsonData = JSON.parse(call[1]);

      expect(jsonData.type).toBe("json");
      expect(jsonData.value).toHaveLength(1);
      expect(jsonData.value[0]).toMatchObject({
        evaluator_name: "code-correctness",
        evaluator_type: "custom",
        status: "processed",
        passed: true,
        score: 0.9,
        details: "Code is syntactically valid",
        metadata: { language: "python" },
      });
      expect(jsonData.value[0].timestamps).toBeDefined();
      expect(jsonData.value[0].timestamps.created_at).toBeTypeOf("number");
      expect(jsonData.value[0].timestamps.updated_at).toBeTypeOf("number");
    });

    it("attaches multiple evaluation results", () => {
      const results: EvaluatorExecutionResult[] = [
        {
          evaluator_name: "evaluator-1",
          status: "processed",
          passed: true,
          score: 0.95,
        },
        {
          evaluator_name: "evaluator-2",
          status: "processed",
          passed: false,
          score: 0.6,
        },
        {
          evaluator_name: "evaluator-3",
          status: "error",
          details: "Evaluation failed",
        },
      ];

      attachEvaluationResults(mockSpan, results);

      const call = (mockSpan.setAttribute as any).mock.calls[0];
      const jsonData = JSON.parse(call[1]);

      expect(jsonData.value).toHaveLength(3);
      expect(jsonData.value[0].evaluator_name).toBe("evaluator-1");
      expect(jsonData.value[1].evaluator_name).toBe("evaluator-2");
      expect(jsonData.value[2].evaluator_name).toBe("evaluator-3");
    });

    it("handles error status evaluations", () => {
      const results: EvaluatorExecutionResult[] = [
        {
          evaluator_name: "failing-evaluator",
          status: "error",
          details: "Evaluation threw an error",
        },
      ];

      attachEvaluationResults(mockSpan, results);

      const call = (mockSpan.setAttribute as any).mock.calls[0];
      const jsonData = JSON.parse(call[1]);

      expect(jsonData.value[0]).toMatchObject({
        evaluator_name: "failing-evaluator",
        status: "error",
        details: "Evaluation threw an error",
      });
    });
  });

  describe("when no evaluation results are provided", () => {
    it("does not set any attributes", () => {
      attachEvaluationResults(mockSpan, []);

      expect(mockSpan.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe("when evaluation results have optional fields missing", () => {
    it("includes only provided fields", () => {
      const results: EvaluatorExecutionResult[] = [
        {
          evaluator_name: "minimal-evaluator",
          status: "processed",
          passed: true,
          score: 0.8,
          // No details or metadata
        },
      ];

      attachEvaluationResults(mockSpan, results);

      const call = (mockSpan.setAttribute as any).mock.calls[0];
      const jsonData = JSON.parse(call[1]);

      expect(jsonData.value[0]).toMatchObject({
        evaluator_name: "minimal-evaluator",
        status: "processed",
        passed: true,
        score: 0.8,
      });
      expect(jsonData.value[0].details).toBeUndefined();
      expect(jsonData.value[0].metadata).toBeUndefined();
    });
  });

  describe("when attaching results with timestamps", () => {
    it("includes created_at and updated_at timestamps", () => {
      const results: EvaluatorExecutionResult[] = [
        {
          evaluator_name: "test-evaluator",
          status: "processed",
          passed: true,
          score: 1.0,
        },
      ];

      const beforeTime = Date.now();
      attachEvaluationResults(mockSpan, results);
      const afterTime = Date.now();

      const call = (mockSpan.setAttribute as any).mock.calls[0];
      const jsonData = JSON.parse(call[1]);

      expect(jsonData.value[0].timestamps.created_at).toBeGreaterThanOrEqual(beforeTime);
      expect(jsonData.value[0].timestamps.created_at).toBeLessThanOrEqual(afterTime);
      expect(jsonData.value[0].timestamps.updated_at).toBeGreaterThanOrEqual(beforeTime);
      expect(jsonData.value[0].timestamps.updated_at).toBeLessThanOrEqual(afterTime);
    });
  });
});
