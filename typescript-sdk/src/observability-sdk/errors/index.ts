/**
 * @module observability/errors
 * @description
 * Error classes for the LangWatch Observability SDK.
 *
 * @remarks
 * This module provides specialized error types for different failure scenarios:
 * - InstrumentationError: Non-blocking errors during span/trace creation
 * - ExportError: Failures when exporting traces to LangWatch
 * - ConfigurationError: Invalid configuration at initialization time
 */

/**
 * Error thrown when instrumentation fails but should not block agent execution.
 *
 * @remarks
 * InstrumentationErrors are non-blocking and should be logged but not propagated.
 * The agent should continue executing normally even if instrumentation fails.
 *
 * @example
 * ```typescript
 * try {
 *   span.setAttribute("key", value);
 * } catch (error) {
 *   throw new InstrumentationError("Failed to set attribute", error);
 * }
 * ```
 */
export class InstrumentationError extends Error {
  /**
   * The underlying error that caused this instrumentation failure.
   */
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "InstrumentationError";
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InstrumentationError);
    }
  }
}

/**
 * Error thrown when exporting traces to LangWatch fails.
 *
 * @remarks
 * ExportErrors are logged but do not block agent execution.
 * The SDK implements retry logic and graceful degradation for export failures.
 *
 * @example
 * ```typescript
 * try {
 *   await exporter.export(spans);
 * } catch (error) {
 *   throw new ExportError("Failed to export traces", error);
 * }
 * ```
 */
export class ExportError extends Error {
  /**
   * The underlying error that caused this export failure.
   */
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "ExportError";
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExportError);
    }
  }
}

/**
 * Error thrown when SDK configuration is invalid at initialization time.
 *
 * @remarks
 * ConfigurationErrors are thrown during setup and should be caught by the application.
 * These errors indicate a problem that must be fixed before the SDK can function.
 *
 * @example
 * ```typescript
 * if (!apiKey) {
 *   throw new ConfigurationError("LANGWATCH_API_KEY is required");
 * }
 * ```
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }
}
