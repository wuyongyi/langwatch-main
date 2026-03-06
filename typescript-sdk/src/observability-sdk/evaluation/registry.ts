/**
 * Evaluator registry for managing custom evaluators.
 */

import { CustomEvaluator } from "./types";

/**
 * Global registry of custom evaluators.
 */
class EvaluatorRegistry {
  private evaluators: Map<string, CustomEvaluator> = new Map();

  /**
   * Register a custom evaluator.
   * @param evaluator The evaluator to register
   * @throws Error if an evaluator with the same name is already registered
   */
  register(evaluator: CustomEvaluator): void {
    if (this.evaluators.has(evaluator.name)) {
      throw new Error(
        `Evaluator with name "${evaluator.name}" is already registered`
      );
    }
    this.evaluators.set(evaluator.name, evaluator);
  }

  /**
   * Get an evaluator by name.
   * @param name The name of the evaluator
   * @returns The evaluator, or undefined if not found
   */
  get(name: string): CustomEvaluator | undefined {
    return this.evaluators.get(name);
  }

  /**
   * Get all registered evaluators.
   * @returns Array of all registered evaluators
   */
  getAll(): CustomEvaluator[] {
    return Array.from(this.evaluators.values());
  }

  /**
   * Check if an evaluator is registered.
   * @param name The name of the evaluator
   * @returns True if the evaluator is registered
   */
  has(name: string): boolean {
    return this.evaluators.has(name);
  }

  /**
   * Unregister an evaluator.
   * @param name The name of the evaluator to unregister
   * @returns True if the evaluator was unregistered, false if it wasn't registered
   */
  unregister(name: string): boolean {
    return this.evaluators.delete(name);
  }

  /**
   * Clear all registered evaluators.
   */
  clear(): void {
    this.evaluators.clear();
  }
}

/**
 * Global evaluator registry instance.
 */
export const evaluatorRegistry = new EvaluatorRegistry();

/**
 * Register a custom evaluator.
 * @param evaluator The evaluator to register
 */
export function registerEvaluator(evaluator: CustomEvaluator): void {
  evaluatorRegistry.register(evaluator);
}
