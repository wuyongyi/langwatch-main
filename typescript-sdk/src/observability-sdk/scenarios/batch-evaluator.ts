/**
 * Batch scenario execution with evaluators.
 */

import type {
  ScenarioBatchExecuteOptions,
  ScenarioResult,
  BatchExecutionWithEvaluatorsResult,
  AggregatedEvaluationScores,
  EvaluationResultSummary,
} from "./types";
import { executeBatchScenarios } from "./batch-executor";
import { scenarioStorage } from "./storage";
import { executeAllEvaluators } from "../evaluation/executor";

/**
 * Execute batch scenarios with evaluators.
 * 
 * Runs configured evaluators on each test case result and aggregates
 * evaluation scores across all test cases.
 */
export async function executeBatchWithEvaluators(
  options: ScenarioBatchExecuteOptions
): Promise<BatchExecutionWithEvaluatorsResult> {
  // Execute scenarios
  const results = await executeBatchScenarios(options);

  // Run evaluators on each result
  const resultsWithEvaluations = await Promise.all(
    results.map(async (result, index) => {
      const scenario = scenarioStorage.get(result.scenarioId);
      if (!scenario) {
        return result;
      }

      // Execute evaluators on the scenario situation and agent output
      // We need to get the agent output from the result
      // For now, we'll execute the agent again to get the output
      // In a real implementation, we'd store the output in the result
      let output: string;
      try {
        output = await options.agent(scenario.situation);
      } catch (error) {
        // If agent fails, skip evaluation
        return result;
      }

      const evaluationResults = await executeAllEvaluators(
        scenario.situation,
        output,
        {
          scenarioId: result.scenarioId,
          traceId: result.traceId,
        }
      );

      const evaluations: EvaluationResultSummary[] = evaluationResults.map(
        (evalResult) => ({
          evaluator_name: evalResult.evaluator_name,
          status: evalResult.status,
          passed: evalResult.passed,
          score: evalResult.score,
          details: evalResult.details,
        })
      );

      return {
        ...result,
        evaluations,
      };
    })
  );

  // Aggregate evaluation scores
  const evaluationScores = aggregateEvaluationScores(
    resultsWithEvaluations
  );

  return {
    results: resultsWithEvaluations,
    evaluationScores,
  };
}

/**
 * Aggregate evaluation scores across all test cases.
 */
function aggregateEvaluationScores(
  results: ScenarioResult[]
): AggregatedEvaluationScores {
  const aggregated: AggregatedEvaluationScores = {};

  for (const result of results) {
    if (!result.evaluations) {
      continue;
    }

    for (const evaluation of result.evaluations) {
      if (evaluation.status !== "processed") {
        continue;
      }

      if (!aggregated[evaluation.evaluator_name]) {
        aggregated[evaluation.evaluator_name] = {
          averageScore: 0,
          passed: 0,
          failed: 0,
          total: 0,
        };
      }

      const agg = aggregated[evaluation.evaluator_name]!;
      agg.total++;

      if (evaluation.passed !== undefined) {
        if (evaluation.passed) {
          agg.passed++;
        } else {
          agg.failed++;
        }
      }

      if (evaluation.score !== undefined) {
        // Update running average
        const prevTotal = agg.total - 1;
        agg.averageScore =
          (agg.averageScore * prevTotal + evaluation.score) / agg.total;
      }
    }
  }

  // Round average scores to 2 decimal places
  for (const evaluatorName in aggregated) {
    aggregated[evaluatorName]!.averageScore = Math.round(
      aggregated[evaluatorName]!.averageScore * 100
    ) / 100;
  }

  return aggregated;
}
