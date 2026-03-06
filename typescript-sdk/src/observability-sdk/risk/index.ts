/**
 * Risk assessment and classification system for Claude Code agents.
 * 
 * This module provides risk level tagging, automatic risk classification,
 * and risk-based monitoring capabilities.
 */

export { RiskClassifier, type RiskLevel } from "./risk-classifier";
export {
  validateRiskLevel,
  tagSpanWithRisk,
  type RiskTagOptions,
} from "./risk-tagging";
