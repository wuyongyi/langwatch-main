/**
 * Risk level classification for agent operations.
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * High-risk operation keywords that indicate destructive or critical operations.
 */
const HIGH_RISK_KEYWORDS = [
  "delete",
  "drop",
  "remove",
  "destroy",
  "truncate",
] as const;

/**
 * Medium-risk operation keywords that indicate modification operations.
 */
const MEDIUM_RISK_KEYWORDS = [
  "update",
  "modify",
  "change",
  "alter",
  "edit",
  "set",
] as const;

/**
 * Automatic risk classifier for agent operations.
 * 
 * Classifies operations based on keywords in the operation name or context.
 */
export class RiskClassifier {
  /**
   * Classify an operation by its name.
   * 
   * @param operation - The operation name to classify
   * @returns The risk level (low, medium, or high)
   */
  classify(operation: string): RiskLevel {
    const lowerOperation = operation.toLowerCase();

    // Check for high-risk keywords
    for (const keyword of HIGH_RISK_KEYWORDS) {
      if (lowerOperation.includes(keyword)) {
        return "high";
      }
    }

    // Check for medium-risk keywords
    for (const keyword of MEDIUM_RISK_KEYWORDS) {
      if (lowerOperation.includes(keyword)) {
        return "medium";
      }
    }

    // Default to low risk
    return "low";
  }

  /**
   * Classify an operation with additional context.
   * 
   * @param operation - The operation name to classify
   * @param context - Additional context (e.g., query text, parameters)
   * @returns The risk level (low, medium, or high)
   */
  classifyWithContext(
    operation: string,
    context: Record<string, any>
  ): RiskLevel {
    // First check the operation name itself
    const operationRisk = this.classify(operation);
    if (operationRisk !== "low") {
      return operationRisk;
    }

    // Check context values for risk keywords
    const contextString = JSON.stringify(context).toLowerCase();

    // Check for high-risk keywords in context
    for (const keyword of HIGH_RISK_KEYWORDS) {
      if (contextString.includes(keyword)) {
        return "high";
      }
    }

    // Check for medium-risk keywords in context
    for (const keyword of MEDIUM_RISK_KEYWORDS) {
      if (contextString.includes(keyword)) {
        return "medium";
      }
    }

    return "low";
  }
}
