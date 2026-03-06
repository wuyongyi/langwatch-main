/**
 * Scenario execution engine.
 */

import { randomUUID } from "crypto";
import type {
  ScenarioExecuteOptions,
  ScenarioResult,
  CriterionResult,
} from "./types";
import { scenarioStorage } from "./storage";

/**
 * Execute a scenario against an agent.
 * 
 * Creates a trace with type "agent_test", executes the agent with the
 * scenario situation as input, and evaluates the output against the
 * scenario criteria.
 */
export async function executeScenario(
  options: ScenarioExecuteOptions
): Promise<ScenarioResult> {
  const { scenarioId, agent, timeout } = options;

  // Get the scenario
  const scenario = scenarioStorage.get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  const startTime = Date.now();
  const traceId = randomUUID();

  try {
    // Execute agent with timeout if specified
    let output: string;
    if (timeout) {
      output = await executeWithTimeout(
        () => agent(scenario.situation),
        timeout
      );
    } else {
      output = await agent(scenario.situation);
    }

    const executionTime = Date.now() - startTime;

    // Evaluate criteria
    const criteriaResults = evaluateCriteria(scenario.criteria, output);
    const passed = criteriaResults.every((result) => result.passed);

    return {
      scenarioId,
      traceId,
      passed,
      criteriaResults,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Mark all criteria as failed
    const criteriaResults: CriterionResult[] = scenario.criteria.map(
      (criterion) => ({
        criterion,
        passed: false,
        details: `Execution failed: ${errorMessage}`,
      })
    );

    return {
      scenarioId,
      traceId,
      passed: false,
      criteriaResults,
      executionTime,
      error: errorMessage,
    };
  }
}

/**
 * Execute a function with a timeout.
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Execution timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Evaluate criteria against output.
 * 
 * This is a simple implementation that checks if the criterion text
 * appears in the output. In a real implementation, this would use
 * LLM-based evaluation or custom evaluator functions.
 */
function evaluateCriteria(
  criteria: string[],
  output: string
): CriterionResult[] {
  return criteria.map((criterion) => {
    // Simple keyword matching for now
    // In production, this would use LLM-based evaluation
    const keywords = extractKeywords(criterion);
    const passed = keywords.some((keyword) =>
      output.toLowerCase().includes(keyword.toLowerCase())
    );

    return {
      criterion,
      passed,
      details: passed
        ? `Criterion satisfied`
        : `Criterion not satisfied in output`,
    };
  });
}

/**
 * Extract keywords from a criterion for simple matching.
 */
function extractKeywords(criterion: string): string[] {
  // Extract quoted strings and significant words
  const quoted = criterion.match(/'([^']+)'|"([^"]+)"/g);
  if (quoted) {
    return quoted.map((q) => q.replace(/['"]/g, ""));
  }

  // Extract significant words (longer than 3 characters)
  const words = criterion
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3 && !isStopWord(word));

  return words;
}

/**
 * Check if a word is a stop word.
 */
function isStopWord(word: string): boolean {
  const stopWords = [
    "contains",
    "includes",
    "should",
    "must",
    "have",
    "with",
    "that",
    "this",
    "from",
    "will",
    "code",
  ];
  return stopWords.includes(word.toLowerCase());
}
