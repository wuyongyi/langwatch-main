/**
 * Evaluation result attachment to spans.
 * 
 * This module provides functionality to attach evaluation results to spans
 * as attributes, enabling them to be exported with traces and displayed
 * in the LangWatch platform.
 */

import type { LangWatchSpan } from "../span/types";
import type { EvaluatorExecutionResult } from "./executor";
import { ATTR_LANGWATCH_EVALUATION_CUSTOM } from "../semconv/attributes";

/**
 * Attach evaluation results to a span as attributes.
 * 
 * This function serializes evaluation results and attaches them to the span
 * using the langwatch.evaluation.custom attribute. The results are stored
 * as JSON to preserve the full structure including evaluator name, status,
 * passed, score, and details.
 * 
 * @param span - The span to attach evaluation results to
 * @param results - Array of evaluation results from evaluator execution
 * 
 * @example
 * ```typescript
 * const results = await executeAllEvaluators(input, output);
 * attachEvaluationResults(span, results);
 * ```
 */
export function attachEvaluationResults(
  span: LangWatchSpan,
  results: EvaluatorExecutionResult[]
): void {
  if (results.length === 0) {
    return;
  }

  // Serialize evaluation results as JSON
  const evaluationData = {
    type: "json" as const,
    value: results.map((result) => ({
      evaluator_name: result.evaluator_name,
      evaluator_type: "custom",
      status: result.status,
      passed: result.passed,
      score: result.score,
      details: result.details,
      metadata: result.metadata,
      timestamps: {
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    })),
  };

  span.setAttribute(
    ATTR_LANGWATCH_EVALUATION_CUSTOM,
    JSON.stringify(evaluationData)
  );
}
