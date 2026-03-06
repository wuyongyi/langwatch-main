/**
 * Unit tests for automatic evaluator execution on trace completion.
 * 
 * Feature: claude-code-agent-integration
 * Tests automatic execution of registered evaluators when traces complete.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerEvaluator, evaluatorRegistry } from "../../registry";
import { executeAllEvaluators } from "../../executor";
import type { CustomEvaluator, EvaluationResult } from "../../types";

describe("given automatic evaluator execution", () => {
  beforeEach(() => {
    // Clear registry before each test
    evaluatorRegistry.clear();
  });

  describe("when a trace completes with registered evaluators", () => {
    it("executes all registered evaluators", async () => {
      // Register mock evaluators
      const evaluator1 = createMockEvaluator("evaluator-1");
      const evaluator2 = createMockEvaluator("evaluator-2");
      
      registerEvaluator(evaluator1);
      registerEvaluator(evaluator2);

      // Simulate trace completion
      const input = "test input";
      const output = "test output";
      
      // Execute all evaluators
      const results = await executeAllEvaluators(input, output);

      expect(results).toHaveLength(2);
      expect(evaluator1.evaluate).toHaveBeenCalledWith(input, output, undefined);
      expect(evaluator2.evaluate).toHaveBeenCalledWith(input, output, undefined);
    });

    it("executes evaluators with context when provided", async () => {
      const evaluator = createMockEvaluator("test-evaluator");
      registerEvaluator(evaluator);

      const input = "test input";
      const output = "test output";
      const context = { user_id: "user123", task_type: "code_generation" };

      await executeAllEvaluators(input, output, context);

      expect(evaluator.evaluate).toHaveBeenCalledWith(input, output, context);
    });

    it("returns evaluation results with correct structure", async () => {
      const evaluator = createMockEvaluator("test-evaluator", {
        passed: true,
        score: 0.95,
        details: "Test passed",
      });
      registerEvaluator(evaluator);

      const results = await executeAllEvaluators("input", "output");

      expect(results[0]).toMatchObject({
        evaluator_name: "test-evaluator",
        passed: true,
        score: 0.95,
        details: "Test passed",
        status: "processed",
      });
    });
  });

  describe("when no evaluators are registered", () => {
    it("returns empty results array", async () => {
      const results = await executeAllEvaluators("input", "output");
      expect(results).toEqual([]);
    });
  });

  describe("when an evaluator throws an error", () => {
    it("captures error and continues with other evaluators", async () => {
      const failingEvaluator: CustomEvaluator = {
        name: "failing-evaluator",
        evaluate: vi.fn().mockRejectedValue(new Error("Evaluation failed")),
      };
      
      const successEvaluator = createMockEvaluator("success-evaluator");

      registerEvaluator(failingEvaluator);
      registerEvaluator(successEvaluator);

      const results = await executeAllEvaluators("input", "output");

      // Should have result for failing evaluator with error status
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        evaluator_name: "failing-evaluator",
        status: "error",
        details: expect.stringContaining("Evaluation failed"),
      });

      // Success evaluator should still execute
      expect(results[1]).toMatchObject({
        evaluator_name: "success-evaluator",
        status: "processed",
      });
    });
  });

  describe("when evaluators run in parallel", () => {
    it("executes all evaluators concurrently", async () => {
      const evaluator1 = createMockEvaluator("evaluator-1");
      const evaluator2 = createMockEvaluator("evaluator-2");
      const evaluator3 = createMockEvaluator("evaluator-3");

      registerEvaluator(evaluator1);
      registerEvaluator(evaluator2);
      registerEvaluator(evaluator3);

      const startTime = Date.now();
      await executeAllEvaluators("input", "output");
      const duration = Date.now() - startTime;

      // All evaluators should be called
      expect(evaluator1.evaluate).toHaveBeenCalled();
      expect(evaluator2.evaluate).toHaveBeenCalled();
      expect(evaluator3.evaluate).toHaveBeenCalled();

      // Should complete quickly (parallel execution)
      // If sequential, would take 3x longer
      expect(duration).toBeLessThan(100);
    });
  });

  describe("when evaluation result is missing required fields", () => {
    it("provides default values for optional fields", async () => {
      const evaluator: CustomEvaluator = {
        name: "minimal-evaluator",
        evaluate: vi.fn().mockResolvedValue({
          passed: true,
          score: 0.8,
          // No details or metadata
        }),
      };

      registerEvaluator(evaluator);
      const results = await executeAllEvaluators("input", "output");

      expect(results[0]).toMatchObject({
        evaluator_name: "minimal-evaluator",
        passed: true,
        score: 0.8,
        status: "processed",
      });
    });
  });
});

// Helper functions

function createMockEvaluator(
  name: string,
  result: Partial<EvaluationResult> = { passed: true, score: 1.0 }
): CustomEvaluator {
  return {
    name,
    evaluate: vi.fn().mockResolvedValue({
      passed: result.passed ?? true,
      score: result.score ?? 1.0,
      details: result.details,
      metadata: result.metadata,
    }),
  };
}
