/**
 * Evaluation framework types for Claude Code agents.
 */

/**
 * Result of an evaluation.
 */
export interface EvaluationResult {
  /** Whether the evaluation passed */
  passed: boolean;
  /** Numeric score between 0.0 and 1.0 */
  score: number;
  /** Optional details about the evaluation */
  details?: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Custom evaluator interface.
 * Evaluators assess the quality of agent outputs.
 */
export interface CustomEvaluator {
  /** Unique name for the evaluator */
  name: string;
  /** Evaluate function that assesses input/output quality */
  evaluate(
    input: string,
    output: string,
    context?: Record<string, any>
  ): Promise<EvaluationResult>;
}

/**
 * Evaluation record stored with traces.
 */
export interface Evaluation {
  evaluation_id: string;
  trace_id: string;
  span_id?: string;
  evaluator_name: string;
  evaluator_type: string;
  status: "processed" | "skipped" | "error";
  passed?: boolean;
  score?: number;
  details?: string;
  cost?: number;
  timestamps: {
    created_at: number;
    updated_at: number;
  };
}
