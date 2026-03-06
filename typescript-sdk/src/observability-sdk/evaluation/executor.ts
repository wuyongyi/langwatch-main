/**
 * Automatic evaluator execution on trace completion.
 * 
 * This module provides functionality to automatically execute registered evaluators
 * when agent traces complete, enabling non-blocking quality assessment.
 */

import { evaluatorRegistry } from "./registry";
import type { EvaluationResult } from "./types";

/**
 * Result of an evaluator execution with status tracking.
 */
export interface EvaluatorExecutionResult {
  evaluator_name: string;
  status: "processed" | "error";
  passed?: boolean;
  score?: number;
  details?: string;
  metadata?: Record<string, any>;
}

/**
 * Execute all registered evaluators on trace input/output.
 * 
 * This function runs all registered evaluators in parallel and returns their results.
 * Errors in individual evaluators are caught and returned as error results, allowing
 * other evaluators to continue executing.
 * 
 * @param input - The input to the agent/trace
 * @param output - The output from the agent/trace
 * @param context - Optional context metadata (user_id, thread_id, etc.)
 * @returns Array of evaluation results
 * 
 * @example
 * ```typescript
 * const results = await executeAllEvaluators(
 *   "Generate a sorting function",
 *   "def sort(arr): return sorted(arr)",
 *   { task_type: "code_generation" }
 * );
 * ```
 */
export async function executeAllEvaluators(
  input: string,
  output: string,
  context?: Record<string, any>
): Promise<EvaluatorExecutionResult[]> {
  const evaluators = evaluatorRegistry.getAll();
  
  if (evaluators.length === 0) {
    return [];
  }

  // Execute all evaluators in parallel for better performance
  const results = await Promise.allSettled(
    evaluators.map(async (evaluator) => {
      try {
        const result = await evaluator.evaluate(input, output, context);
        return {
          evaluator_name: evaluator.name,
          status: "processed" as const,
          passed: result.passed,
          score: result.score,
          details: result.details,
          metadata: result.metadata,
        };
      } catch (error) {
        // Capture error but don't throw - allow other evaluators to continue
        return {
          evaluator_name: evaluator.name,
          status: "error" as const,
          details: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  // Extract values from settled promises
  return results.map((result) => 
    result.status === "fulfilled" ? result.value : result.reason
  );
}

/**
 * Execute evaluators on trace completion (non-blocking).
 * 
 * This function is designed to be called when a trace completes. It executes
 * evaluators asynchronously without blocking the trace completion, ensuring
 * that evaluation failures don't impact agent performance.
 * 
 * @param input - The input to the agent/trace
 * @param output - The output from the agent/trace
 * @param context - Optional context metadata
 * @param onResults - Optional callback to handle results (e.g., send to LangWatch)
 * 
 * @example
 * ```typescript
 * // In trace completion handler
 * executeEvaluatorsAsync(
 *   traceInput,
 *   traceOutput,
 *   { user_id: "user123" },
 *   (results) => {
 *     // Send results to LangWatch or log them
 *     console.log("Evaluation results:", results);
 *   }
 * );
 * ```
 */
export function executeEvaluatorsAsync(
  input: string,
  output: string,
  context?: Record<string, any>,
  onResults?: (results: EvaluatorExecutionResult[]) => void
): void {
  // Execute asynchronously without blocking
  executeAllEvaluators(input, output, context)
    .then((results) => {
      if (onResults) {
        onResults(results);
      }
    })
    .catch((error) => {
      // Log error but don't throw - evaluation failures shouldn't break the agent
      console.error("Error executing evaluators:", error);
    });
}

/**
 * Execute evaluators and return a promise.
 * 
 * This function executes evaluators and returns a promise that resolves
 * with the results. This is useful when you want to wait for evaluation
 * results before proceeding, such as when attaching results to a span.
 * 
 * @param input - The input to the agent/trace
 * @param output - The output from the agent/trace
 * @param context - Optional context metadata
 * @returns Promise that resolves with evaluation results
 * 
 * @example
 * ```typescript
 * const results = await executeEvaluatorsSync(input, output);
 * attachEvaluationResults(span, results);
 * ```
 */
export async function executeEvaluatorsSync(
  input: string,
  output: string,
  context?: Record<string, any>
): Promise<EvaluatorExecutionResult[]> {
  return executeAllEvaluators(input, output, context);
}
