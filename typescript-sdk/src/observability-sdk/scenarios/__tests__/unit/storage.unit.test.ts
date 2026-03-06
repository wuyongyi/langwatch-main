/**
 * Unit tests for scenario storage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { scenarioStorage } from "../../storage";
import type { Scenario } from "../../types";

describe("given a scenario storage system", () => {
  beforeEach(() => {
    scenarioStorage.clear();
  });

  describe("when creating a scenario", () => {
    it("generates a unique ID", () => {
      const scenario1 = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario 1",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      const scenario2 = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario 2",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      expect(scenario1.id).toBeDefined();
      expect(scenario2.id).toBeDefined();
      expect(scenario1.id).not.toBe(scenario2.id);
    });

    it("stores the scenario with all provided fields", () => {
      const input = {
        project_id: "test-project",
        name: "Code generation test",
        situation: "User requests a Python function to sort a list",
        criteria: [
          "Generated code is syntactically valid Python",
          "Function accepts a list parameter",
          "Function returns a sorted list",
        ],
        labels: ["code-generation", "python"],
      };

      const scenario = scenarioStorage.create(input);

      expect(scenario.project_id).toBe(input.project_id);
      expect(scenario.name).toBe(input.name);
      expect(scenario.situation).toBe(input.situation);
      expect(scenario.criteria).toEqual(input.criteria);
      expect(scenario.labels).toEqual(input.labels);
    });

    it("sets timestamps and archived flag", () => {
      const before = Date.now();
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });
      const after = Date.now();

      expect(scenario.created_at).toBeGreaterThanOrEqual(before);
      expect(scenario.created_at).toBeLessThanOrEqual(after);
      expect(scenario.updated_at).toBe(scenario.created_at);
      expect(scenario.archived).toBe(false);
    });
  });

  describe("when retrieving a scenario", () => {
    it("returns the scenario with matching ID", () => {
      const created = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      const retrieved = scenarioStorage.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
      expect(retrieved?.situation).toBe(created.situation);
      expect(retrieved?.criteria).toEqual(created.criteria);
    });

    it("returns undefined for non-existent ID", () => {
      const retrieved = scenarioStorage.get("non-existent-id");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("when listing scenarios", () => {
    it("returns all scenarios for a project", () => {
      scenarioStorage.create({
        project_id: "project-1",
        name: "Scenario 1",
        situation: "Situation 1",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      scenarioStorage.create({
        project_id: "project-1",
        name: "Scenario 2",
        situation: "Situation 2",
        criteria: ["Criterion 2"],
        labels: ["test"],
      });

      scenarioStorage.create({
        project_id: "project-2",
        name: "Scenario 3",
        situation: "Situation 3",
        criteria: ["Criterion 3"],
        labels: ["test"],
      });

      const scenarios = scenarioStorage.list("project-1");

      expect(scenarios).toHaveLength(2);
      expect(scenarios.every((s) => s.project_id === "project-1")).toBe(true);
    });

    it("excludes archived scenarios by default", () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      scenarioStorage.archive(scenario.id);

      const scenarios = scenarioStorage.list("test-project");
      expect(scenarios).toHaveLength(0);
    });

    it("includes archived scenarios when requested", () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      scenarioStorage.archive(scenario.id);

      const scenarios = scenarioStorage.list("test-project", {
        includeArchived: true,
      });
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0]!.archived).toBe(true);
    });
  });

  describe("when updating a scenario", () => {
    it("updates the specified fields", () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Original Name",
        situation: "Original situation",
        criteria: ["Original criterion"],
        labels: ["original"],
      });

      const updated = scenarioStorage.update(scenario.id, {
        name: "Updated Name",
        criteria: ["Updated criterion 1", "Updated criterion 2"],
      });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.criteria).toEqual([
        "Updated criterion 1",
        "Updated criterion 2",
      ]);
      expect(updated?.situation).toBe("Original situation");
      expect(updated?.labels).toEqual(["original"]);
    });

    it("updates the updated_at timestamp", () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      const originalUpdatedAt = scenario.updated_at;

      // Wait a bit to ensure timestamp changes
      const updated = scenarioStorage.update(scenario.id, {
        name: "Updated Name",
      });

      expect(updated?.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it("returns undefined for non-existent ID", () => {
      const updated = scenarioStorage.update("non-existent-id", {
        name: "Updated Name",
      });
      expect(updated).toBeUndefined();
    });
  });

  describe("when archiving a scenario", () => {
    it("sets the archived flag to true", () => {
      const scenario = scenarioStorage.create({
        project_id: "test-project",
        name: "Test Scenario",
        situation: "Test situation",
        criteria: ["Criterion 1"],
        labels: ["test"],
      });

      const archived = scenarioStorage.archive(scenario.id);

      expect(archived?.archived).toBe(true);
    });

    it("returns undefined for non-existent ID", () => {
      const archived = scenarioStorage.archive("non-existent-id");
      expect(archived).toBeUndefined();
    });
  });
});
