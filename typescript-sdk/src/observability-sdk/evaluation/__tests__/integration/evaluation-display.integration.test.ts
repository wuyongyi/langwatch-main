/**
 * Integration tests for evaluation result display in traces.
 * 
 * Feature: claude-code-agent-integration
 * Tests the complete flow of executing evaluators and attaching results to spans.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { 
  registerEvaluator, 
  evaluatorRegistry,
  executeEvaluatorsSync,
  attachEvaluationResults,
} from "../..";
import type { CustomEvaluator } from "../../types";
import { trace } from "@opentelemetry/api";
import { 
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_LANGWATCH_EVALUATION_CUSTOM } from "../../../semconv/attributes";
import { createLangWatchSpan } from "../../../span";

describe("given evaluation result display integration", () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    // Clear registry
    evaluatorRegistry.clear();

    // Create a simple in-memory setup without full observability
    exporter = new InMemorySpanExporter();
    const spanProcessor = new SimpleSpanProcessor(exporter);
    provider = new BasicTracerProvider({
      spanProcessors: [spanProcessor],
    });
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(async () => {
    evaluatorRegistry.clear();
    exporter.reset();
    await provider.shutdown();
  });

  describe("when executing evaluators and attaching results to a span", () => {
    it("exports span with evaluation results as attributes", async () => {
      // Register test evaluators
      const codeEvaluator: CustomEvaluator = {
        name: "code-correctness",
        evaluate: async (input, output) => ({
          passed: true,
          score: 0.95,
          details: "Code is syntactically valid",
        }),
      };

      const accuracyEvaluator: CustomEvaluator = {
        name: "response-accuracy",
        evaluate: async (input, output) => ({
          passed: true,
          score: 0.9,
          details: "Response is accurate",
        }),
      };

      registerEvaluator(codeEvaluator);
      registerEvaluator(accuracyEvaluator);

      // Create a trace with evaluation
      const tracer = provider.getTracer("test-agent");
      const span = tracer.startSpan("agent-execution");
      const langwatchSpan = createLangWatchSpan(span);

      const input = "Generate a Python sorting function";
      const output = "def sort(arr): return sorted(arr)";

      langwatchSpan.setInput(input);
      langwatchSpan.setOutput(output);

      // Execute evaluators and attach results
      const results = await executeEvaluatorsSync(input, output);
      attachEvaluationResults(langwatchSpan, results);

      langwatchSpan.end();

      // Wait for export
      await provider.forceFlush();

      // Verify span was exported with evaluation results
      const exportedSpans = exporter.getFinishedSpans();
      expect(exportedSpans).toHaveLength(1);

      const exportedSpan = exportedSpans[0] as ReadableSpan;
      const evaluationAttr = exportedSpan.attributes[ATTR_LANGWATCH_EVALUATION_CUSTOM];

      expect(evaluationAttr).toBeDefined();
      expect(typeof evaluationAttr).toBe("string");

      const evaluationData = JSON.parse(evaluationAttr as string);
      expect(evaluationData.type).toBe("json");
      expect(evaluationData.value).toHaveLength(2);

      // Verify first evaluator result
      expect(evaluationData.value[0]).toMatchObject({
        evaluator_name: "code-correctness",
        evaluator_type: "custom",
        status: "processed",
        passed: true,
        score: 0.95,
        details: "Code is syntactically valid",
      });

      // Verify second evaluator result
      expect(evaluationData.value[1]).toMatchObject({
        evaluator_name: "response-accuracy",
        evaluator_type: "custom",
        status: "processed",
        passed: true,
        score: 0.9,
        details: "Response is accurate",
      });
    });

    it("handles evaluator errors gracefully", async () => {
      // Register evaluators with one that fails
      const successEvaluator: CustomEvaluator = {
        name: "success-evaluator",
        evaluate: async () => ({
          passed: true,
          score: 1.0,
        }),
      };

      const failingEvaluator: CustomEvaluator = {
        name: "failing-evaluator",
        evaluate: async () => {
          throw new Error("Evaluation failed");
        },
      };

      registerEvaluator(successEvaluator);
      registerEvaluator(failingEvaluator);

      // Create span and execute evaluators
      const tracer = provider.getTracer("test-agent");
      const span = tracer.startSpan("agent-execution");
      const langwatchSpan = createLangWatchSpan(span);

      const results = await executeEvaluatorsSync("input", "output");
      attachEvaluationResults(langwatchSpan, results);

      langwatchSpan.end();

      await provider.forceFlush();

      // Verify both results are attached
      const exportedSpans = exporter.getFinishedSpans();
      const exportedSpan = exportedSpans[0] as ReadableSpan;
      const evaluationAttr = exportedSpan.attributes[ATTR_LANGWATCH_EVALUATION_CUSTOM];
      const evaluationData = JSON.parse(evaluationAttr as string);

      expect(evaluationData.value).toHaveLength(2);

      // Success evaluator result
      expect(evaluationData.value[0]).toMatchObject({
        evaluator_name: "success-evaluator",
        status: "processed",
        passed: true,
        score: 1.0,
      });

      // Failed evaluator result
      expect(evaluationData.value[1]).toMatchObject({
        evaluator_name: "failing-evaluator",
        status: "error",
        details: expect.stringContaining("Evaluation failed"),
      });
    });

    it("works with nested spans", async () => {
      // Register evaluator
      const evaluator: CustomEvaluator = {
        name: "test-evaluator",
        evaluate: async () => ({
          passed: true,
          score: 0.85,
        }),
      };

      registerEvaluator(evaluator);

      // Create nested spans
      const tracer = provider.getTracer("test-agent");
      const parentSpan = tracer.startSpan("parent-operation");
      const childSpan = tracer.startSpan("child-operation");
      const langwatchChildSpan = createLangWatchSpan(childSpan);

      // Attach evaluations to child span
      const results = await executeEvaluatorsSync("input", "output");
      attachEvaluationResults(langwatchChildSpan, results);

      langwatchChildSpan.end();
      parentSpan.end();

      await provider.forceFlush();

      // Verify child span has evaluation results
      const exportedSpans = exporter.getFinishedSpans();
      const childExportedSpan = exportedSpans.find(
        (s) => s.name === "child-operation"
      ) as ReadableSpan;

      expect(childExportedSpan).toBeDefined();
      const evaluationAttr = childExportedSpan.attributes[ATTR_LANGWATCH_EVALUATION_CUSTOM];
      expect(evaluationAttr).toBeDefined();

      const evaluationData = JSON.parse(evaluationAttr as string);
      expect(evaluationData.value).toHaveLength(1);
      expect(evaluationData.value[0].evaluator_name).toBe("test-evaluator");
    });
  });

  describe("when no evaluators are registered", () => {
    it("does not attach evaluation attributes", async () => {
      const tracer = provider.getTracer("test-agent");
      const span = tracer.startSpan("agent-execution");
      const langwatchSpan = createLangWatchSpan(span);

      const results = await executeEvaluatorsSync("input", "output");
      attachEvaluationResults(langwatchSpan, results);

      langwatchSpan.end();

      await provider.forceFlush();

      const exportedSpans = exporter.getFinishedSpans();
      const exportedSpan = exportedSpans[0] as ReadableSpan;
      const evaluationAttr = exportedSpan.attributes[ATTR_LANGWATCH_EVALUATION_CUSTOM];

      expect(evaluationAttr).toBeUndefined();
    });
  });
});
