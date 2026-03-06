/**
 * Unit tests for batch evaluator execution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeBatchWithEvaluators } from "../../batch-evaluator";
import { scenarioStorage } from "../../storage";
import { evaluatorRegistry } from "../../../evaluation/registry";
import type { CustomEvaluator } from "../../../evaluation/types";

describe("given a batch evaluator execution system", () => {
  beforeEach(() => {
    scenarioStorage.clear();
    evaluatorRegistry.clear();
  });

  describe("when executing batch with evaluators", () => {
    it("runs evaluators on each test case result", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: vi.fn().mockResolvedValue({
          passed: true,
          score: 0.9,
          details: "Good",
        }),
      };

      evaluatorRegistry.register(evaluator);

      const agent = vi.fn().mockResolvedValue("output");

      await executeBatchWithEvaluators({
        scenarioIds: [scenario1.id, scenario2.id],
        agent,
      });

      expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
    });

    it("passes scenario situation and agent output to evaluators", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate code",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: vi.fn().mockResolvedValue({
          passed: true,
          score: 0.9,
        }),
      };

      evaluatorRegistry.register(evaluator);

      const agent = vi.fn().mockResolvedValue("def hello(): pass");

      await executeBatchWithEvaluators({
        scenarioIds: [scenario.id],
        agent,
      });

      expect(evaluator.evaluate).toHaveBeenCalledWith(
        "Generate code",
        "def hello(): pass",
        expect.any(Object)
      );
    });

    it("aggregates evaluation scores across all test cases", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: vi
          .fn()
          .mockResolvedValueOnce({ passed: true, score: 0.8 })
          .mockResolvedValueOnce({ passed: true, score: 0.9 }),
      };

      evaluatorRegistry.register(evaluator);

      const agent = vi.fn().mockResolvedValue("output");

      const result = await executeBatchWithEvaluators({
        scenarioIds: [scenario1.id, scenario2.id],
        agent,
      });

      expect(result.evaluationScores).toBeDefined();
      expect(result.evaluationScores["test-evaluator"]).toBeDefined();
      expect(result.evaluationScores["test-evaluator"]!.averageScore).toBe(
        0.85
      );
    });

    it("tracks pass/fail counts per evaluator", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario3 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 3",
        situation: "Situation 3",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: vi
          .fn()
          .mockResolvedValueOnce({ passed: true, score: 0.9 })
          .mockResolvedValueOnce({ passed: false, score: 0.4 })
          .mockResolvedValueOnce({ passed: true, score: 0.8 }),
      };

      evaluatorRegistry.register(evaluator);

      const agent = vi.fn().mockResolvedValue("output");

      const result = await executeBatchWithEvaluators({
        scenarioIds: [scenario1.id, scenario2.id, scenario3.id],
        agent,
      });

      expect(result.evaluationScores["test-evaluator"]!.passed).toBe(2);
      expect(result.evaluationScores["test-evaluator"]!.failed).toBe(1);
      expect(result.evaluationScores["test-evaluator"]!.total).toBe(3);
    });

    it("handles multiple evaluators", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Situation",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator1: CustomEvaluator = {
        name: "evaluator-1",
        evaluate: vi.fn().mockResolvedValue({ passed: true, score: 0.9 }),
      };

      const evaluator2: CustomEvaluator = {
        name: "evaluator-2",
        evaluate: vi.fn().mockResolvedValue({ passed: true, score: 0.8 }),
      };

      evaluatorRegistry.register(evaluator1);
      evaluatorRegistry.register(evaluator2);

      const agent = vi.fn().mockResolvedValue("output");

      const result = await executeBatchWithEvaluators({
        scenarioIds: [scenario.id],
        agent,
      });

      expect(result.evaluationScores["evaluator-1"]).toBeDefined();
      expect(result.evaluationScores["evaluator-2"]).toBeDefined();
    });

    it("continues evaluation when one evaluator fails", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Situation",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator1: CustomEvaluator = {
        name: "evaluator-1",
        evaluate: vi.fn().mockRejectedValue(new Error("Evaluator failed")),
      };

      const evaluator2: CustomEvaluator = {
        name: "evaluator-2",
        evaluate: vi.fn().mockResolvedValue({ passed: true, score: 0.8 }),
      };

      evaluatorRegistry.register(evaluator1);
      evaluatorRegistry.register(evaluator2);

      const agent = vi.fn().mockResolvedValue("output");

      const result = await executeBatchWithEvaluators({
        scenarioIds: [scenario.id],
        agent,
      });

      expect(result.evaluationScores["evaluator-2"]).toBeDefined();
      expect(result.evaluationScores["evaluator-2"]!.averageScore).toBe(0.8);
    });

    it("includes evaluation results in scenario results", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Situation",
        criteria: ["output"],
        labels: ["test"],
      });

      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: vi.fn().mockResolvedValue({
          passed: true,
          score: 0.9,
          details: "Excellent",
        }),
      };

      evaluatorRegistry.register(evaluator);

      const agent = vi.fn().mockResolvedValue("output");

      const result = await executeBatchWithEvaluators({
        scenarioIds: [scenario.id],
        agent,
      });

      expect(result.results[0]!.evaluations).toBeDefined();
      expect(result.results[0]!.evaluations).toHaveLength(1);
      expect(result.results[0]!.evaluations![0]!.evaluator_name).toBe(
        "test-evaluator"
      );
      expect(result.results[0]!.evaluations![0]!.passed).toBe(true);
      expect(result.results[0]!.evaluations![0]!.score).toBe(0.9);
    });
  });

  describe("when no evaluators are registered", () => {
    it("executes scenarios without evaluation", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Situation",
        criteria: ["output"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("output");

      const result = await executeBatchWithEvaluators({
        scenarioIds: [scenario.id],
        agent,
      });

      expect(result.results).toHaveLength(1);
      expect(result.evaluationScores).toEqual({});
    });
  });
});
