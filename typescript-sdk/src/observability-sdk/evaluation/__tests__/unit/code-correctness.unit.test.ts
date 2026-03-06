/**
 * Unit tests for built-in code correctness evaluator.
 * 
 * Feature: claude-code-agent-integration
 * Tests the code correctness evaluator that checks syntax validity and conventions.
 */

import { describe, it, expect } from "vitest";
import { codeCorrectnessEvaluator } from "../../evaluators/code-correctness";

describe("given code correctness evaluator", () => {
  describe("when evaluating valid Python code", () => {
    it("passes for syntactically correct code", async () => {
      const input = "Write a function to sort a list";
      const output = `def sort_list(items):
    """Sort a list of items."""
    return sorted(items)`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it("passes for code with proper docstrings", async () => {
      const input = "Create a class";
      const output = `class Calculator:
    """A simple calculator class."""
    
    def add(self, a, b):
        """Add two numbers."""
        return a + b`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });
  });

  describe("when evaluating valid JavaScript code", () => {
    it("passes for syntactically correct code", async () => {
      const input = "Write a function to filter array";
      const output = `function filterArray(arr, predicate) {
  return arr.filter(predicate);
}`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it("passes for modern ES6+ syntax", async () => {
      const input = "Create an async function";
      const output = `const fetchData = async (url) => {
  const response = await fetch(url);
  return response.json();
};`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });
  });

  describe("when evaluating invalid code", () => {
    it("fails for Python syntax errors", async () => {
      const input = "Write a function";
      const output = `def broken_function(
    # Missing closing parenthesis
    return "broken"`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.5);
      expect(result.details?.toLowerCase()).toContain("syntax");
    });

    it("fails for JavaScript syntax errors", async () => {
      const input = "Write a function";
      const output = `function broken() {
  const x = ;  // Invalid syntax
  return x
}`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.5);
      expect(result.details?.toLowerCase()).toContain("syntax");
    });

    it("fails for incomplete code blocks", async () => {
      const input = "Write a function";
      const output = `function incomplete() {
  const x = 1;
  // Missing closing brace`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.5);
    });
  });

  describe("when evaluating code with security issues", () => {
    it("detects SQL injection vulnerabilities", async () => {
      const input = "Write a database query function";
      const output = `function getUserData(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("SQL injection");
    });

    it("detects XSS vulnerabilities", async () => {
      const input = "Write HTML rendering function";
      const output = `function renderUser(name) {
  document.innerHTML = "<div>" + name + "</div>";
}`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("XSS");
    });

    it("detects eval usage", async () => {
      const input = "Write a calculator";
      const output = `function calculate(expression) {
  return eval(expression);
}`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("eval");
    });
  });

  describe("when evaluating non-code output", () => {
    it("handles plain text gracefully", async () => {
      const input = "Explain sorting";
      const output = "Sorting is the process of arranging items in order.";

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      // Should not crash, but may have low score
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it("handles mixed text and code", async () => {
      const input = "Explain and show code";
      const output = `Here's a sorting function:

\`\`\`python
def sort(arr):
    return sorted(arr)
\`\`\`

This function uses Python's built-in sorted().`;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      // Should extract and evaluate the code block
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
    });
  });

  describe("when evaluating code with language hints", () => {
    it("uses context to determine language", async () => {
      const input = "Write a Python function";
      const output = `def hello():
    print("Hello")`;
      const context = { language: "python" };

      const result = await codeCorrectnessEvaluator.evaluate(input, output, context);

      expect(result.passed).toBe(true);
    });

    it("detects language from code markers", async () => {
      const input = "Write code";
      const output = `\`\`\`javascript
function hello() {
  console.log("Hello");
}
\`\`\``;

      const result = await codeCorrectnessEvaluator.evaluate(input, output);

      expect(result.passed).toBe(true);
    });
  });
});
