/**
 * Unit tests for built-in task completion evaluator.
 * 
 * Feature: claude-code-agent-integration
 * Tests the task completion evaluator that verifies tasks are fully completed.
 */

import { describe, it, expect } from "vitest";
import { taskCompletionEvaluator } from "../../evaluators/task-completion";

describe("given task completion evaluator", () => {
  describe("when evaluating complete task responses", () => {
    it("passes for fully completed tasks", async () => {
      const input = "Write a function to calculate factorial";
      const output = `Here's a factorial function:

\`\`\`python
def factorial(n):
    """Calculate factorial of n."""
    if n <= 1:
        return 1
    return n * factorial(n - 1)
\`\`\`

This function uses recursion to calculate the factorial.`;

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it("passes for tasks with proper formatting", async () => {
      const input = "Create a list of prime numbers under 20";
      const output = "Prime numbers under 20: [2, 3, 5, 7, 11, 13, 17, 19]";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });
  });

  describe("when evaluating incomplete task responses", () => {
    it("fails for partial completions", async () => {
      const input = "Write a function to sort and filter an array";
      const output = "Here's a sort function: arr.sort()";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details?.toLowerCase()).toMatch(/incomplete|not completed|missing/);
    });

    it("fails for responses that don't address the task", async () => {
      const input = "Calculate the sum of 1 to 100";
      const output = "I can help you with calculations.";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.5);
    });

    it("fails for responses with missing components", async () => {
      const input = "Create a class with constructor and methods";
      const output = `class MyClass:
    def __init__(self):
        pass`;

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("missing");
    });
  });

  describe("when evaluating format compliance", () => {
    it("detects when output format doesn't match requirements", async () => {
      const input = "Return the result as JSON";
      const output = "The result is: value = 42";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("format");
    });

    it("passes when output format matches requirements", async () => {
      const input = "Return the result as JSON";
      const output = '{"result": 42, "status": "success"}';

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it("detects when list format is required but not provided", async () => {
      const input = "List all the steps";
      const output = "You need to do several things.";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.6);
    });
  });

  describe("when evaluating with success criteria", () => {
    it("checks against provided success criteria", async () => {
      const input = "Write a function";
      const output = `def my_function(x):
    return x * 2`;
      const context = {
        success_criteria: ["function is defined", "function has parameter", "function returns value"]
      };

      const result = await taskCompletionEvaluator.evaluate(input, output, context);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it("fails when success criteria are not met", async () => {
      const input = "Write a documented function";
      const output = `def my_function(x):
    return x * 2`;
      const context = {
        success_criteria: ["function has docstring", "function has type hints"]
      };

      const result = await taskCompletionEvaluator.evaluate(input, output, context);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("criteria");
    });
  });

  describe("when evaluating action completion", () => {
    it("detects when requested action is performed", async () => {
      const input = "Calculate 15 * 23";
      const output = "15 * 23 = 345";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it("detects when action is not performed", async () => {
      const input = "Calculate 15 * 23";
      const output = "I can help you with multiplication.";

      const result = await taskCompletionEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("not completed");
    });
  });
});
