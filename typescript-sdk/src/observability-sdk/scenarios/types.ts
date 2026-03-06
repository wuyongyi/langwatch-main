/**
 * Scenario testing types for Claude Code agents.
 */

/**
 * Scenario definition for testing agent behavior.
 */
export interface Scenario {
  /** Unique identifier for the scenario */
  id: string;
  /** Project ID this scenario belongs to */
  project_id: string;
  /** Human-readable name for the scenario */
  name: string;
  /** Context description that will be provided to the agent */
  situation: string;
  /** Success criteria that must be met */
  criteria: string[];
  /** Tags for organization and filtering */
  labels: string[];
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
  /** Whether the scenario is archived */
  archived: boolean;
}

/**
 * Result of executing a single scenario.
 */
export interface ScenarioResult {
  /** ID of the scenario that was executed */
  scenarioId: string;
  /** Trace ID created during execution */
  traceId: string;
  /** Whether all criteria passed */
  passed: boolean;
  /** Results for each criterion */
  criteriaResults: CriterionResult[];
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error message if execution failed */
  error?: string;
  /** Evaluation results if evaluators were run */
  evaluations?: EvaluationResultSummary[];
}

/**
 * Result of evaluating a single criterion.
 */
export interface CriterionResult {
  /** The criterion that was evaluated */
  criterion: string;
  /** Whether the criterion passed */
  passed: boolean;
  /** Optional details about the evaluation */
  details?: string;
}

/**
 * Execution record stored in the database.
 */
export interface ScenarioExecution {
  /** Unique identifier for this execution */
  id: string;
  /** ID of the scenario that was executed */
  scenario_id: string;
  /** Trace ID created during execution */
  trace_id: string;
  /** Whether all criteria passed */
  passed: boolean;
  /** Results for each criterion */
  criteria_results: CriterionResult[];
  /** Execution time in milliseconds */
  execution_time_ms: number;
  /** Error message if execution failed */
  error?: string;
  /** Execution timestamp */
  created_at: number;
}

/**
 * Options for executing a scenario.
 */
export interface ScenarioExecuteOptions {
  /** ID of the scenario to execute */
  scenarioId: string;
  /** Agent function to execute */
  agent: (input: string) => Promise<string>;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for batch scenario execution.
 */
export interface ScenarioBatchExecuteOptions {
  /** IDs of scenarios to execute */
  scenarioIds: string[];
  /** Agent function to execute */
  agent: (input: string) => Promise<string>;
  /** Whether to execute scenarios in parallel */
  parallel?: boolean;
  /** Maximum number of concurrent executions */
  maxConcurrency?: number;
  /** Optional timeout per scenario in milliseconds */
  timeout?: number;
}

/**
 * Summary report for batch scenario execution.
 */
export interface ScenarioReport {
  /** Total number of scenarios executed */
  total: number;
  /** Number of scenarios that passed */
  passed: number;
  /** Number of scenarios that failed */
  failed: number;
  /** Pass rate as a percentage (0-100) */
  passRate: number;
  /** Individual scenario results */
  results: ScenarioResult[];
}

/**
 * Evaluation result summary for a single test case.
 */
export interface EvaluationResultSummary {
  /** Name of the evaluator */
  evaluator_name: string;
  /** Status of the evaluation */
  status: "processed" | "error";
  /** Whether the evaluation passed */
  passed?: boolean;
  /** Numeric score (0.0 to 1.0) */
  score?: number;
  /** Optional details */
  details?: string;
}

/**
 * Aggregated evaluation scores across all test cases.
 */
export interface AggregatedEvaluationScores {
  /** Scores aggregated by evaluator name */
  [evaluatorName: string]: {
    /** Average score across all test cases */
    averageScore: number;
    /** Number of test cases that passed */
    passed: number;
    /** Number of test cases that failed */
    failed: number;
    /** Total number of test cases evaluated */
    total: number;
  };
}

/**
 * Result of batch execution with evaluators.
 */
export interface BatchExecutionWithEvaluatorsResult {
  /** Scenario execution results */
  results: ScenarioResult[];
  /** Aggregated evaluation scores */
  evaluationScores: AggregatedEvaluationScores;
}
