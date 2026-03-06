import type { Span } from "@opentelemetry/api";
import type { RiskLevel } from "./risk-classifier";

/**
 * Valid risk levels for agent operations.
 */
const VALID_RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high"];

/**
 * Options for tagging a span with risk information.
 */
export interface RiskTagOptions {
  /** The risk level (low, medium, or high) */
  level: RiskLevel;
  /** Optional reason for the risk classification */
  reason?: string;
}

/**
 * Validate that a risk level is one of the allowed values.
 * 
 * @param level - The risk level to validate
 * @throws Error if the risk level is invalid
 */
export function validateRiskLevel(level: RiskLevel): void {
  if (!VALID_RISK_LEVELS.includes(level)) {
    throw new Error(
      `Invalid risk level: ${level}. Must be one of: ${VALID_RISK_LEVELS.join(", ")}`
    );
  }
}

/**
 * Tag a span with risk level and optional reason.
 * 
 * @param span - The OpenTelemetry span to tag
 * @param options - Risk tagging options
 * @throws Error if the risk level is invalid
 */
export function tagSpanWithRisk(span: Span, options: RiskTagOptions): void {
  validateRiskLevel(options.level);

  span.setAttribute("langwatch.risk.level", options.level);

  if (options.reason) {
    span.setAttribute("langwatch.risk.reason", options.reason);
  }
}
