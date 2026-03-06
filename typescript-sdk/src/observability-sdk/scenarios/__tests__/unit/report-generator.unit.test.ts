/**
 * Unit tests for scenario report generation.
 */

import { describe, it, expect } from "vitest";
import { generateScenarioReport } from "../../report-generator";
import type { ScenarioResult } from "../../types";

describe("given a scenario report generator", () => {
  describe("when generating a report from results", () => {
    it("calculates total count", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: true }),
        createResult({ passed: false }),
        createResult({ passed: true }),
      ];

      const report = generateScenarioReport(results);

      expect(report.total).toBe(3);
    });

    it("calculates passed count", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: true }),
        createResult({ passed: false }),
        createResult({ passed: true }),
        createResult({ passed: true }),
      ];

      const report = generateScenarioReport(results);

      expect(report.passed).toBe(3);
    });

    it("calculates failed count", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: true }),
        createResult({ passed: false }),
        createResult({ passed: false }),
        createResult({ passed: true }),
      ];

      const report = generateScenarioReport(results);

      expect(report.failed).toBe(2);
    });

    it("calculates pass rate as percentage", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: true }),
        createResult({ passed: true }),
        createResult({ passed: true }),
        createResult({ passed: false }),
      ];

      const report = generateScenarioReport(results);

      expect(report.passRate).toBe(75);
    });

    it("handles 100% pass rate", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: true }),
        createResult({ passed: true }),
      ];

      const report = generateScenarioReport(results);

      expect(report.passRate).toBe(100);
    });

    it("handles 0% pass rate", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: false }),
        createResult({ passed: false }),
      ];

      const report = generateScenarioReport(results);

      expect(report.passRate).toBe(0);
    });

    it("handles empty results", () => {
      const results: ScenarioResult[] = [];

      const report = generateScenarioReport(results);

      expect(report.total).toBe(0);
      expect(report.passed).toBe(0);
      expect(report.failed).toBe(0);
      expect(report.passRate).toBe(0);
    });

    it("includes individual test case results", () => {
      const results: ScenarioResult[] = [
        createResult({ scenarioId: "scenario-1", passed: true }),
        createResult({ scenarioId: "scenario-2", passed: false }),
      ];

      const report = generateScenarioReport(results);

      expect(report.results).toHaveLength(2);
      expect(report.results[0]!.scenarioId).toBe("scenario-1");
      expect(report.results[0]!.passed).toBe(true);
      expect(report.results[1]!.scenarioId).toBe("scenario-2");
      expect(report.results[1]!.passed).toBe(false);
    });

    it("includes details for each result", () => {
      const results: ScenarioResult[] = [
        createResult({
          scenarioId: "scenario-1",
          passed: true,
          criteriaResults: [
            { criterion: "Criterion 1", passed: true },
            { criterion: "Criterion 2", passed: true },
          ],
          executionTime: 100,
        }),
      ];

      const report = generateScenarioReport(results);

      expect(report.results[0]!.criteriaResults).toHaveLength(2);
      expect(report.results[0]!.executionTime).toBe(100);
    });

    it("rounds pass rate to 2 decimal places", () => {
      const results: ScenarioResult[] = [
        createResult({ passed: true }),
        createResult({ passed: true }),
        createResult({ passed: false }),
      ];

      const report = generateScenarioReport(results);

      expect(report.passRate).toBe(66.67);
    });
  });
});

/**
 * Helper to create a scenario result for testing.
 */
function createResult(
  overrides: Partial<ScenarioResult> = {}
): ScenarioResult {
  return {
    scenarioId: "test-scenario",
    traceId: "test-trace",
    passed: true,
    criteriaResults: [],
    executionTime: 0,
    ...overrides,
  };
}
