/**
 * Batch scenario execution engine.
 */

import type {
  ScenarioBatchExecuteOptions,
  ScenarioResult,
} from "./types";
import { executeScenario } from "./executor";

/**
 * Execute multiple scenarios in batch.
 * 
 * Supports both sequential and parallel execution with configurable
 * concurrency limits.
 */
export async function executeBatchScenarios(
  options: ScenarioBatchExecuteOptions
): Promise<ScenarioResult[]> {
  const {
    scenarioIds,
    agent,
    parallel = false,
    maxConcurrency = 3,
    timeout,
  } = options;

  if (!parallel) {
    // Sequential execution
    const results: ScenarioResult[] = [];
    for (const scenarioId of scenarioIds) {
      const result = await executeScenario({
        scenarioId,
        agent,
        timeout,
      });
      results.push(result);
    }
    return results;
  }

  // Parallel execution with concurrency limit
  return executeWithConcurrencyLimit(
    scenarioIds,
    async (scenarioId) => {
      return executeScenario({
        scenarioId,
        agent,
        timeout,
      });
    },
    maxConcurrency
  );
}

/**
 * Execute tasks with a concurrency limit.
 */
async function executeWithConcurrencyLimit<T, R>(
  items: T[],
  executor: (item: T) => Promise<R>,
  maxConcurrency: number
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const index = i;

    const promise = executor(item).then((result) => {
      results[index] = result;
      // Remove from executing array when done
      const execIndex = executing.indexOf(promise);
      if (execIndex > -1) {
        executing.splice(execIndex, 1);
      }
    });

    executing.push(promise);

    // Wait if we've reached the concurrency limit
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining promises
  await Promise.all(executing);

  return results as R[];
}
