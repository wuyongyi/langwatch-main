/**
 * Unit tests for batch scenario execution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeBatchScenarios } from "../../batch-executor";
import { scenarioStorage } from "../../storage";

describe("given a batch scenario executor", () => {
  beforeEach(() => {
    scenarioStorage.clear();
  });

  describe("when executing scenarios in batch", () => {
    it("executes all scenarios", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["Criterion 2"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("output");

      const results = await executeBatchScenarios({
        scenarioIds: [scenario1.id, scenario2.id],
        agent,
      });

      expect(results).toHaveLength(2);
      expect(results[0]!.scenarioId).toBe(scenario1.id);
      expect(results[1]!.scenarioId).toBe(scenario2.id);
    });

    it("collects results from all executions", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["output"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("output");

      const results = await executeBatchScenarios({
        scenarioIds: [scenario1.id, scenario2.id],
        agent,
      });

      expect(results[0]!.traceId).toBeDefined();
      expect(results[0]!.passed).toBe(true);
      expect(results[0]!.executionTime).toBeGreaterThanOrEqual(0);

      expect(results[1]!.traceId).toBeDefined();
      expect(results[1]!.passed).toBe(true);
      expect(results[1]!.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("executes sequentially by default", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["output"],
        labels: ["test"],
      });

      const executionOrder: number[] = [];
      const agent = vi.fn().mockImplementation(async (input: string) => {
        const scenarioNum = input.includes("1") ? 1 : 2;
        executionOrder.push(scenarioNum);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "output";
      });

      await executeBatchScenarios({
        scenarioIds: [scenario1.id, scenario2.id],
        agent,
        parallel: false,
      });

      expect(executionOrder).toEqual([1, 2]);
    });
  });

  describe("when executing scenarios in parallel", () => {
    it("executes scenarios concurrently", async () => {
      const scenarios = Array.from({ length: 5 }, (_, i) =>
        scenarioStorage.create({
          project_id: "test-project",
          name: `Scenario ${i + 1}`,
          situation: `Situation ${i + 1}`,
          criteria: ["output"],
          labels: ["test"],
        })
      );

      const agent = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "output";
      });

      const startTime = Date.now();
      await executeBatchScenarios({
        scenarioIds: scenarios.map((s) => s.id),
        agent,
        parallel: true,
      });
      const duration = Date.now() - startTime;

      // If executed sequentially, would take ~50ms
      // If executed in parallel, should take ~10-20ms
      expect(duration).toBeLessThan(40);
    });

    it("respects max concurrency limit", async () => {
      const scenarios = Array.from({ length: 6 }, (_, i) =>
        scenarioStorage.create({
          project_id: "test-project",
          name: `Scenario ${i + 1}`,
          situation: `Situation ${i + 1}`,
          criteria: ["output"],
          labels: ["test"],
        })
      );

      let currentConcurrent = 0;
      let maxConcurrent = 0;

      const agent = vi.fn().mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return "output";
      });

      await executeBatchScenarios({
        scenarioIds: scenarios.map((s) => s.id),
        agent,
        parallel: true,
        maxConcurrency: 3,
      });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe("when a scenario fails", () => {
    it("continues executing remaining scenarios", async () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["output"],
        labels: ["test"],
      });

      const scenario3 = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 3",
        situation: "Situation 3",
        criteria: ["output"],
        labels: ["test"],
      });

      const agent = vi
        .fn()
        .mockResolvedValueOnce("output")
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce("output");

      const results = await executeBatchScenarios({
        scenarioIds: [scenario1.id, scenario2.id, scenario3.id],
        agent,
      });

      expect(results).toHaveLength(3);
      expect(results[0]!.passed).toBe(true);
      expect(results[1]!.passed).toBe(false);
      expect(results[1]!.error).toContain("Failed");
      expect(results[2]!.passed).toBe(true);
    });
  });

  describe("when timeout is specified", () => {
    it("applies timeout to each scenario execution", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["output"],
        labels: ["test"],
      });

      const agent = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "output";
      });

      const results = await executeBatchScenarios({
        scenarioIds: [scenario.id],
        agent,
        timeout: 10,
      });

      expect(results[0]!.passed).toBe(false);
      expect(results[0]!.error).toContain("timeout");
    });
  });
});
