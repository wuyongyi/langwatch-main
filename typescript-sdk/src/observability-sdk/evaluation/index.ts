/**
 * Evaluation framework for Claude Code agents.
 * 
 * This module provides evaluator interfaces, built-in evaluators for code correctness,
 * response accuracy, and task completion, plus custom evaluator registration.
 */

export type {
  EvaluationResult,
  CustomEvaluator,
  Evaluation,
} from "./types";

export type { EvaluatorExecutionResult } from "./executor";

export { registerEvaluator, evaluatorRegistry } from "./registry";
export { 
  executeAllEvaluators, 
  executeEvaluatorsAsync,
  executeEvaluatorsSync 
} from "./executor";
export { attachEvaluationResults } from "./span-attachment";
export { codeCorrectnessEvaluator } from "./evaluators/code-correctness";
export { responseAccuracyEvaluator } from "./evaluators/response-accuracy";
export { taskCompletionEvaluator } from "./evaluators/task-completion";
