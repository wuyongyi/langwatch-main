/**
 * Agent-specific observability setup for Claude Code agents.
 * 
 * This module provides a simplified setup function specifically designed for
 * instrumenting Claude Code agents with LangWatch observability.
 */

import { type AgentInstrumentationConfig } from "../agent-instrumentation-types";
import { setupObservability, type ObservabilityHandle } from "./node";
import { TraceIdRatioBasedSampler, ParentBasedSampler } from "@opentelemetry/sdk-trace-base";
import { SamplingMetadataProcessor } from "../processors/sampling-metadata-processor";

/**
 * Configuration error thrown when setup fails due to invalid configuration.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Sets up observability for Claude Code agents.
 * 
 * This is a convenience wrapper around setupObservability that provides
 * agent-specific defaults and validation.
 * 
 * @param config - Agent instrumentation configuration
 * @returns Handle with shutdown function
 * @throws {ConfigurationError} If configuration is invalid
 * 
 * @example
 * ```typescript
 * import { setupAgentObservability } from "langwatch/observability";
 * 
 * const handle = setupAgentObservability({
 *   apiKey: process.env.LANGWATCH_API_KEY,
 *   serviceName: "my-claude-agent",
 *   samplingRate: 1.0,
 * });
 * 
 * // Your agent code here
 * 
 * // Graceful shutdown
 * await handle.shutdown();
 * ```
 */
export function setupAgentObservability(
  config: AgentInstrumentationConfig
): ObservabilityHandle {
  // Validate API key
  const apiKey = config.apiKey || process.env.LANGWATCH_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError(
      "API key is required. Provide it via config.apiKey or LANGWATCH_API_KEY environment variable."
    );
  }

  // Validate sampling rate if provided
  if (config.samplingRate !== undefined) {
    if (config.samplingRate < 0 || config.samplingRate > 1) {
      throw new ConfigurationError(
        "samplingRate must be between 0.0 and 1.0"
      );
    }
  }

  // Build attributes from custom metadata
  const attributes: Record<string, string> = {
    ...config.customMetadata,
  };

  // Configure sampler if sampling rate is provided
  const sampler = config.samplingRate !== undefined
    ? new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(config.samplingRate),
      })
    : undefined;

  // Create sampling metadata processor if sampling rate is provided
  const spanProcessors = config.samplingRate !== undefined
    ? [new SamplingMetadataProcessor({ samplingRate: config.samplingRate })]
    : undefined;

  // Call the underlying setupObservability with agent-specific configuration
  return setupObservability({
    langwatch: {
      apiKey,
      endpoint: config.endpoint,
      processorType: "batch",
    },
    serviceName: config.serviceName,
    attributes,
    sampler,
    spanProcessors,
    dataCapture: config.captureInput === false && config.captureOutput === false
      ? "none"
      : config.captureInput === false
      ? "output"
      : config.captureOutput === false
      ? "input"
      : "all",
    advanced: {
      throwOnSetupError: config.advanced?.throwOnSetupError ?? true, // Agents should fail fast on setup errors
      UNSAFE_forceOpenTelemetryReinitialization: config.advanced?.UNSAFE_forceOpenTelemetryReinitialization,
    },
  });
}
