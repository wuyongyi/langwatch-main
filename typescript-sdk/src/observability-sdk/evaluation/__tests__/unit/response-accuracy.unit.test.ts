/**
 * Unit tests for built-in response accuracy evaluator.
 * 
 * Feature: claude-code-agent-integration
 * Tests the response accuracy evaluator that assesses answer quality.
 */

import { describe, it, expect } from "vitest";
import { responseAccuracyEvaluator } from "../../evaluators/response-accuracy";

describe("given response accuracy evaluator", () => {
  describe("when evaluating relevant responses", () => {
    it("passes for responses that address the input", async () => {
      const input = "What is the capital of France?";
      const output = "The capital of France is Paris.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it("passes for detailed responses", async () => {
      const input = "Explain how sorting algorithms work";
      const output = `Sorting algorithms arrange elements in a specific order. Common algorithms include:
- Bubble sort: Repeatedly swaps adjacent elements
- Quick sort: Uses divide-and-conquer approach
- Merge sort: Divides array and merges sorted subarrays`;

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("when evaluating irrelevant responses", () => {
    it("fails for completely unrelated responses", async () => {
      const input = "What is the capital of France?";
      const output = "I like pizza and ice cream.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.5);
    });

    it("fails for generic non-answers", async () => {
      const input = "How do I sort an array?";
      const output = "That's a good question.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.5);
    });
  });

  describe("when evaluating incomplete responses", () => {
    it("detects partial answers", async () => {
      const input = "Explain the three laws of thermodynamics";
      const output = "The first law states that energy cannot be created or destroyed.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.score).toBeLessThan(0.8);
      expect(result.details).toContain("partial");
    });

    it("detects vague responses", async () => {
      const input = "How do I implement a binary search?";
      const output = "You need to use a search algorithm.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.6);
    });
  });

  describe("when evaluating responses with hallucinations", () => {
    it("detects uncertain language", async () => {
      const input = "What is the speed of light?";
      const output = "I think the speed of light might be around 300,000 km/s, but I'm not sure.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.details).toContain("uncertain");
    });

    it("detects contradictions", async () => {
      const input = "Is Python compiled or interpreted?";
      const output = "Python is a compiled language. Actually, it's interpreted. Well, it's both.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.score).toBeLessThan(0.7);
    });
  });

  describe("when evaluating error responses", () => {
    it("detects error messages", async () => {
      const input = "Calculate 2 + 2";
      const output = "Error: Unable to process request";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("error");
    });

    it("detects refusals", async () => {
      const input = "What is 2 + 2?";
      const output = "I cannot answer that question.";

      const result = await responseAccuracyEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.3);
    });
  });

  describe("when evaluating with expected output", () => {
    it("compares against expected output when provided", async () => {
      const input = "What is 2 + 2?";
      const output = "4";
      const context = { expected_output: "4" };

      const result = await responseAccuracyEvaluator.evaluate(input, output, context);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
    });

    it("detects mismatch with expected output", async () => {
      const input = "What is 2 + 2?";
      const output = "5";
      const context = { expected_output: "4" };

      const result = await responseAccuracyEvaluator.evaluate(input, output, context);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("expected");
    });
  });
});
