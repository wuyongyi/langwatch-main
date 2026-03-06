/**
 * @module observability/exporters/retry-exporter
 * @description
 * Provides exponential backoff retry logic for trace export failures.
 *
 * @remarks
 * When export fails, the exporter retries with exponential backoff.
 * The delay between retries increases exponentially up to a maximum delay.
 */

import { type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { type ExportResult, ExportResultCode } from "@opentelemetry/core";
import { ExportError } from "../errors/index";
import { getObservabilitySdkLogger } from "../config";

/**
 * Configuration for retry behavior with exponential backoff.
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry.
   * @default 1000
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries.
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff.
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Callback invoked when all retries are exhausted.
   */
  onRetriesExhausted?: (error: ExportError, spans: ReadableSpan[]) => void;
}

/**
 * Wrapper that adds exponential backoff retry logic to any span exporter.
 *
 * @remarks
 * This wrapper intercepts export failures and retries with exponential backoff.
 * The delay between retries increases exponentially: initialDelay * (multiplier ^ attempt).
 * After max retries, the error is logged and the callback is invoked.
 *
 * @example
 * ```typescript
 * import { LangWatchTraceExporter } from '@langwatch/observability';
 * import { RetryExporter } from '@langwatch/observability/exporters';
 *
 * const baseExporter = new LangWatchTraceExporter();
 * const exporter = new RetryExporter(baseExporter, {
 *   maxRetries: 5,
 *   initialDelayMs: 500,
 *   maxDelayMs: 60000,
 *   backoffMultiplier: 2,
 * });
 * ```
 */
export class RetryExporter {
  private readonly baseExporter: {
    export(
      spans: ReadableSpan[],
      resultCallback: (result: ExportResult) => void
    ): void;
    shutdown(): Promise<void>;
  };
  private readonly config: Required<RetryConfig>;

  constructor(
    baseExporter: {
      export(
        spans: ReadableSpan[],
        resultCallback: (result: ExportResult) => void
      ): void;
      shutdown(): Promise<void>;
    },
    config?: RetryConfig
  ) {
    this.baseExporter = baseExporter;
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      initialDelayMs: config?.initialDelayMs ?? 1000,
      maxDelayMs: config?.maxDelayMs ?? 30000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      onRetriesExhausted: config?.onRetriesExhausted ?? (() => {}),
    };
  }

  /**
   * Export spans with retry logic.
   *
   * @param spans - Spans to export
   * @param resultCallback - Callback to invoke with export result
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    this.exportWithRetry(spans, 0, resultCallback);
  }

  /**
   * Internal method to export with retry logic.
   *
   * @param spans - Spans to export
   * @param attempt - Current attempt number (0-indexed)
   * @param resultCallback - Callback to invoke with export result
   */
  private exportWithRetry(
    spans: ReadableSpan[],
    attempt: number,
    resultCallback: (result: ExportResult) => void
  ): void {
    const logger = getObservabilitySdkLogger();

    this.baseExporter.export(spans, (result) => {
      if (result.code === ExportResultCode.SUCCESS) {
        // Success - invoke callback
        if (attempt > 0) {
          logger.info(
            `[LangWatch] Export succeeded after ${attempt} ${attempt === 1 ? "retry" : "retries"}`
          );
        }
        resultCallback(result);
      } else {
        // Failure - check if we should retry
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          logger.warn(
            `[LangWatch] Export failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}), retrying in ${delay}ms`
          );

          // Schedule retry
          setTimeout(() => {
            this.exportWithRetry(spans, attempt + 1, resultCallback);
          }, delay);
        } else {
          // Retries exhausted
          logger.error(
            `[LangWatch] Export failed after ${this.config.maxRetries + 1} attempts, giving up`
          );

          const error = new ExportError(
            `Failed to export ${spans.length} spans after ${this.config.maxRetries + 1} attempts`,
            result.error instanceof Error ? result.error : undefined
          );

          this.config.onRetriesExhausted(error, spans);

          // Return failure result
          resultCallback(result);
        }
      }
    });
  }

  /**
   * Calculate delay for exponential backoff.
   *
   * @param attempt - Current attempt number (0-indexed)
   * @returns Delay in milliseconds
   */
  private calculateDelay(attempt: number): number {
    const delay =
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Shutdown the exporter.
   */
  async shutdown(): Promise<void> {
    await this.baseExporter.shutdown();
  }
}

/**
 * Helper function to export spans with retry logic.
 *
 * @param exporter - Base exporter to use
 * @param spans - Spans to export
 * @param config - Retry configuration
 * @returns Promise that resolves when export succeeds or retries are exhausted
 *
 * @example
 * ```typescript
 * import { exportWithRetry } from '@langwatch/observability/exporters';
 *
 * await exportWithRetry(exporter, spans, {
 *   maxRetries: 3,
 *   initialDelayMs: 1000,
 * });
 * ```
 */
export async function exportWithRetry(
  exporter: {
    export(
      spans: ReadableSpan[],
      resultCallback: (result: ExportResult) => void
    ): void;
  },
  spans: ReadableSpan[],
  config?: RetryConfig
): Promise<void> {
  const retryConfig: Required<RetryConfig> = {
    maxRetries: config?.maxRetries ?? 3,
    initialDelayMs: config?.initialDelayMs ?? 1000,
    maxDelayMs: config?.maxDelayMs ?? 30000,
    backoffMultiplier: config?.backoffMultiplier ?? 2,
    onRetriesExhausted: config?.onRetriesExhausted ?? (() => {}),
  };

  const logger = getObservabilitySdkLogger();

  let attempt = 0;
  let delay = retryConfig.initialDelayMs;

  while (attempt <= retryConfig.maxRetries) {
    try {
      const result = await new Promise<ExportResult>((resolve) => {
        exporter.export(spans, resolve);
      });

      if (result.code === ExportResultCode.SUCCESS) {
        if (attempt > 0) {
          logger.info(
            `[LangWatch] Export succeeded after ${attempt} ${attempt === 1 ? "retry" : "retries"}`
          );
        }
        return;
      }

      // Export failed
      if (attempt < retryConfig.maxRetries) {
        logger.warn(
          `[LangWatch] Export failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), retrying in ${delay}ms`
        );
        await sleep(delay);
        delay = Math.min(
          delay * retryConfig.backoffMultiplier,
          retryConfig.maxDelayMs
        );
        attempt++;
      } else {
        // Retries exhausted
        logger.error(
          `[LangWatch] Export failed after ${retryConfig.maxRetries + 1} attempts`
        );

        const error = new ExportError(
          `Failed to export ${spans.length} spans after ${retryConfig.maxRetries + 1} attempts`,
          result.error instanceof Error ? result.error : undefined
        );

        retryConfig.onRetriesExhausted(error, spans);
        throw error;
      }
    } catch (error) {
      if (error instanceof ExportError) {
        throw error;
      }

      if (attempt < retryConfig.maxRetries) {
        logger.warn(
          `[LangWatch] Export threw error (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), retrying in ${delay}ms`
        );
        await sleep(delay);
        delay = Math.min(
          delay * retryConfig.backoffMultiplier,
          retryConfig.maxDelayMs
        );
        attempt++;
      } else {
        logger.error(
          `[LangWatch] Export failed after ${retryConfig.maxRetries + 1} attempts`
        );

        const exportError = new ExportError(
          `Failed to export ${spans.length} spans after ${retryConfig.maxRetries + 1} attempts`,
          error instanceof Error ? error : undefined
        );

        retryConfig.onRetriesExhausted(exportError, spans);
        throw exportError;
      }
    }
  }
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
