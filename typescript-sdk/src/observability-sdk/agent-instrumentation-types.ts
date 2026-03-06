/**
 * Type definitions for Claude Code Agent instrumentation.
 * 
 * These types define the configuration and data structures used throughout
 * the agent instrumentation layer.
 */

import { type SpanType } from "./span/types";

/**
 * Configuration for agent instrumentation setup.
 */
export interface AgentInstrumentationConfig {
  /** LangWatch API key for authentication */
  apiKey: string;
  
  /** Custom OTLP endpoint (defaults to LangWatch production endpoint) */
  endpoint?: string;
  
  /** Service name for identifying the agent in traces */
  serviceName: string;
  
  /** Sampling rate (0.0 to 1.0) for trace collection */
  samplingRate?: number;
  
  /** Whether to capture function input in traces */
  captureInput?: boolean;
  
  /** Whether to capture function output in traces */
  captureOutput?: boolean;
  
  /** Custom redaction rules for sensitive data */
  redactionRules?: RedactionRule[];
  
  /** Custom metadata to attach to all traces */
  customMetadata?: Record<string, string>;
  
  /** Advanced configuration options */
  advanced?: {
    /** Force OpenTelemetry reinitialization (for testing only) */
    UNSAFE_forceOpenTelemetryReinitialization?: boolean;
    /** Throw errors on setup failures instead of logging */
    throwOnSetupError?: boolean;
  };
}

/**
 * Redaction rule for sensitive data.
 */
export interface RedactionRule {
  /** Pattern to match (regex string) */
  pattern: string;
  
  /** Replacement text (defaults to "[REDACTED]") */
  replacement?: string;
  
  /** Fields to apply redaction to (defaults to all) */
  fields?: string[];
}

/**
 * Risk level classification for operations.
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * Span type classifications for agent operations.
 * Uses the standard LangWatch SpanType.
 */
export type AgentSpanType = SpanType;
