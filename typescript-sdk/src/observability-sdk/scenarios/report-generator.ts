/**
 * Scenario report generation.
 */

import type { ScenarioResult, ScenarioReport } from "./types";

/**
 * Generate a summary report from scenario execution results.
 * 
 * Calculates pass rate, total, passed, and failed counts, and includes
 * individual test case results with details.
 */
export function generateScenarioReport(
  results: ScenarioResult[]
): ScenarioReport {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const passRate = total > 0 ? Math.round((passed / total) * 10000) / 100 : 0;

  return {
    total,
    passed,
    failed,
    passRate,
    results,
  };
}
