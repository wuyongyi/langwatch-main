/**
 * Unit tests for evaluator registry.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { evaluatorRegistry, registerEvaluator } from "../../registry";
import { CustomEvaluator, EvaluationResult } from "../../types";

describe("given an evaluator registry", () => {
  beforeEach(() => {
    // Clear registry before each test
    evaluatorRegistry.clear();
  });

  describe("when registering a custom evaluator", () => {
    it("stores the evaluator and makes it retrievable", () => {
      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      };

      registerEvaluator(evaluator);

      const retrieved = evaluatorRegistry.get("test-evaluator");
      expect(retrieved).toBe(evaluator);
    });

    it("adds the evaluator to the list of all evaluators", () => {
      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      };

      registerEvaluator(evaluator);

      const all = evaluatorRegistry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toBe(evaluator);
    });
  });

  describe("when registering multiple evaluators", () => {
    it("stores all evaluators independently", () => {
      const evaluator1: CustomEvaluator = {
        name: "evaluator-1",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      };
      const evaluator2: CustomEvaluator = {
        name: "evaluator-2",
        evaluate: async () => ({ passed: false, score: 0.5 }),
      };

      registerEvaluator(evaluator1);
      registerEvaluator(evaluator2);

      expect(evaluatorRegistry.get("evaluator-1")).toBe(evaluator1);
      expect(evaluatorRegistry.get("evaluator-2")).toBe(evaluator2);
      expect(evaluatorRegistry.getAll()).toHaveLength(2);
    });
  });

  describe("when registering an evaluator with a duplicate name", () => {
    it("throws an error", () => {
      const evaluator1: CustomEvaluator = {
        name: "duplicate",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      };
      const evaluator2: CustomEvaluator = {
        name: "duplicate",
        evaluate: async () => ({ passed: false, score: 0.0 }),
      };

      registerEvaluator(evaluator1);

      expect(() => registerEvaluator(evaluator2)).toThrow(
        'Evaluator with name "duplicate" is already registered'
      );
    });
  });

  describe("when checking if an evaluator exists", () => {
    it("returns true for registered evaluators", () => {
      const evaluator: CustomEvaluator = {
        name: "exists",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      };

      registerEvaluator(evaluator);

      expect(evaluatorRegistry.has("exists")).toBe(true);
    });

    it("returns false for unregistered evaluators", () => {
      expect(evaluatorRegistry.has("does-not-exist")).toBe(false);
    });
  });

  describe("when unregistering an evaluator", () => {
    it("removes the evaluator from the registry", () => {
      const evaluator: CustomEvaluator = {
        name: "to-remove",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      };

      registerEvaluator(evaluator);
      const removed = evaluatorRegistry.unregister("to-remove");

      expect(removed).toBe(true);
      expect(evaluatorRegistry.has("to-remove")).toBe(false);
      expect(evaluatorRegistry.get("to-remove")).toBeUndefined();
    });

    it("returns false when unregistering a non-existent evaluator", () => {
      const removed = evaluatorRegistry.unregister("does-not-exist");
      expect(removed).toBe(false);
    });
  });

  describe("when clearing the registry", () => {
    it("removes all evaluators", () => {
      registerEvaluator({
        name: "eval-1",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      });
      registerEvaluator({
        name: "eval-2",
        evaluate: async () => ({ passed: true, score: 1.0 }),
      });

      evaluatorRegistry.clear();

      expect(evaluatorRegistry.getAll()).toHaveLength(0);
      expect(evaluatorRegistry.has("eval-1")).toBe(false);
      expect(evaluatorRegistry.has("eval-2")).toBe(false);
    });
  });

  describe("when getting a non-existent evaluator", () => {
    it("returns undefined", () => {
      const result = evaluatorRegistry.get("does-not-exist");
      expect(result).toBeUndefined();
    });
  });
});
