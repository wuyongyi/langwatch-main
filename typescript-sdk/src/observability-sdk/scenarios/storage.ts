/**
 * In-memory storage for scenarios.
 * 
 * Note: This is a simple in-memory implementation for the SDK.
 * In production, scenarios would be stored in the LangWatch database
 * and accessed via API endpoints.
 */

import { randomUUID } from "crypto";
import type { Scenario } from "./types";

/**
 * Input for creating a new scenario.
 */
export interface CreateScenarioInput {
  project_id: string;
  name: string;
  situation: string;
  criteria: string[];
  labels: string[];
}

/**
 * Input for updating an existing scenario.
 */
export interface UpdateScenarioInput {
  name?: string;
  situation?: string;
  criteria?: string[];
  labels?: string[];
}

/**
 * Options for listing scenarios.
 */
export interface ListScenariosOptions {
  includeArchived?: boolean;
}

/**
 * In-memory scenario storage.
 */
class ScenarioStorage {
  private scenarios: Map<string, Scenario> = new Map();

  /**
   * Create a new scenario.
   */
  create(input: CreateScenarioInput): Scenario {
    const now = Date.now();
    const scenario: Scenario = {
      id: randomUUID(),
      project_id: input.project_id,
      name: input.name,
      situation: input.situation,
      criteria: [...input.criteria],
      labels: [...input.labels],
      created_at: now,
      updated_at: now,
      archived: false,
    };

    this.scenarios.set(scenario.id, scenario);
    return scenario;
  }

  /**
   * Get a scenario by ID.
   */
  get(id: string): Scenario | undefined {
    return this.scenarios.get(id);
  }

  /**
   * List all scenarios for a project.
   */
  list(
    projectId: string,
    options: ListScenariosOptions = {}
  ): Scenario[] {
    const { includeArchived = false } = options;

    return Array.from(this.scenarios.values()).filter(
      (scenario) =>
        scenario.project_id === projectId &&
        (includeArchived || !scenario.archived)
    );
  }

  /**
   * Update a scenario.
   */
  update(
    id: string,
    input: UpdateScenarioInput
  ): Scenario | undefined {
    const scenario = this.scenarios.get(id);
    if (!scenario) {
      return undefined;
    }

    const updated: Scenario = {
      ...scenario,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.situation !== undefined && { situation: input.situation }),
      ...(input.criteria !== undefined && { criteria: [...input.criteria] }),
      ...(input.labels !== undefined && { labels: [...input.labels] }),
      updated_at: Date.now(),
    };

    this.scenarios.set(id, updated);
    return updated;
  }

  /**
   * Archive a scenario.
   */
  archive(id: string): Scenario | undefined {
    const scenario = this.scenarios.get(id);
    if (!scenario) {
      return undefined;
    }

    const archived: Scenario = {
      ...scenario,
      archived: true,
      updated_at: Date.now(),
    };

    this.scenarios.set(id, archived);
    return archived;
  }

  /**
   * Delete a scenario (for testing).
   */
  delete(id: string): boolean {
    return this.scenarios.delete(id);
  }

  /**
   * Clear all scenarios (for testing).
   */
  clear(): void {
    this.scenarios.clear();
  }
}

/**
 * Global scenario storage instance.
 */
export const scenarioStorage = new ScenarioStorage();
