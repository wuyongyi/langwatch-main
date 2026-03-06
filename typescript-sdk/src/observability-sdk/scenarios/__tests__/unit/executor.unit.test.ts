/**
 * Unit tests for scenario execution engine.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeScenario } from "../../executor";
import { scenarioStorage } from "../../storage";

describe("given a scenario execution engine", () => {
  beforeEach(() => {
    scenarioStorage.clear();
  });

  describe("when executing a scenario", () => {
    it("creates a trace with type agent_test", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code is syntactically valid"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("def hello(): return 'Hello'");

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.traceId).toBeDefined();
      expect(result.scenarioId).toBe(scenario.id);
    });

    it("passes the situation as input to the agent", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code is syntactically valid"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("def hello(): return 'Hello'");

      await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(agent).toHaveBeenCalledWith("Generate a hello world function");
    });

    it("evaluates each criterion against the output", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: [
          "Code is syntactically valid",
          "Function is named hello",
          "Function returns a string",
        ],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("def hello(): return 'Hello'");

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.criteriaResults).toHaveLength(3);
      expect(result.criteriaResults[0]!.criterion).toBe(
        "Code is syntactically valid"
      );
      expect(result.criteriaResults[1]!.criterion).toBe(
        "Function is named hello"
      );
      expect(result.criteriaResults[2]!.criterion).toBe(
        "Function returns a string"
      );
    });

    it("returns pass/fail status for each criterion", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code contains 'hello'", "Code contains 'goodbye'"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("def hello(): return 'Hello'");

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.criteriaResults[0]!.passed).toBe(true);
      expect(result.criteriaResults[1]!.passed).toBe(false);
    });

    it("marks overall result as passed when all criteria pass", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code contains 'hello'", "Code contains 'def'"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("def hello(): return 'Hello'");

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.passed).toBe(true);
    });

    it("marks overall result as failed when any criterion fails", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code contains 'hello'", "Code contains 'goodbye'"],
        labels: ["test"],
      });

      const agent = vi.fn().mockResolvedValue("def hello(): return 'Hello'");

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.passed).toBe(false);
    });

    it("records execution time", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code is valid"],
        labels: ["test"],
      });

      const agent = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "def hello(): return 'Hello'";
      });

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.executionTime).toBeGreaterThan(0);
    });

    it("throws error for non-existent scenario", async () => {
      const agent = vi.fn().mockResolvedValue("output");

      await expect(
        executeScenario({
          scenarioId: "non-existent-id",
          agent,
        })
      ).rejects.toThrow("Scenario not found");
    });
  });

  describe("when execution times out", () => {
    it("fails with timeout error", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code is valid"],
        labels: ["test"],
      });

      const agent = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "output";
      });

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
        timeout: 10,
      });

      expect(result.passed).toBe(false);
      expect(result.error).toContain("timeout");
    });
  });

  describe("when agent throws an error", () => {
    it("captures the error in the result", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Code is valid"],
        labels: ["test"],
      });

      const agent = vi.fn().mockRejectedValue(new Error("Agent failed"));

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.passed).toBe(false);
      expect(result.error).toContain("Agent failed");
    });

    it("marks all criteria as failed", async () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Generate a hello world function",
        criteria: ["Criterion 1", "Criterion 2"],
        labels: ["test"],
      });

      const agent = vi.fn().mockRejectedValue(new Error("Agent failed"));

      const result = await executeScenario({
        scenarioId: scenario.id,
        agent,
      });

      expect(result.criteriaResults).toHaveLength(2);
      expect(result.criteriaResults[0]!.passed).toBe(false);
      expect(result.criteriaResults[1]!.passed).toBe(false);
    });
  });
});
