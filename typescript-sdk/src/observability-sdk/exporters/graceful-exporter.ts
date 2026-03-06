/**
 * @module observability/exporters/graceful-exporter
 * @description
 * Provides graceful degradation for trace export failures.
 *
 * @remarks
 * When the LangWatch endpoint is unavailable, traces are queued locally.
 * If the queue reaches its limit, oldest traces are dropped (FIFO).
 * Agent execution continues normally even if tracing fails.
 */

import { type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { type ExportResult, ExportResultCode } from "@opentelemetry/core";
import { ExportError } from "../errors/index";
import { getObservabilitySdkLogger } from "../config";

/**
 * Configuration for graceful degradation behavior.
 */
export interface GracefulDegradationConfig {
  /**
   * Maximum number of traces to queue when endpoint is unavailable.
   * @default 1000
   */
  maxQueueSize?: number;

  /**
   * Callback invoked when traces are dropped due to queue overflow.
   */
  onTracesDropped?: (count: number) => void;

  /**
   * Callback invoked when export fails.
   */
  onExportError?: (error: ExportError) => void;
}

/**
 * Wrapper that adds graceful degradation to any span exporter.
 *
 * @remarks
 * This wrapper intercepts export failures and queues spans locally.
 * When the queue is full, oldest spans are dropped (FIFO).
 * The wrapper periodically attempts to flush the queue.
 *
 * @example
 * ```typescript
 * import { LangWatchTraceExporter } from '@langwatch/observability';
 * import { GracefulExporter } from '@langwatch/observability/exporters';
 *
 * const baseExporter = new LangWatchTraceExporter();
 * const exporter = new GracefulExporter(baseExporter, {
 *   maxQueueSize: 500,
 *   onTracesDropped: (count) => console.warn(`Dropped ${count} traces`),
 * });
 * ```
 */
export class GracefulExporter {
  private readonly baseExporter: {
    export(
      spans: ReadableSpan[],
      resultCallback: (result: ExportResult) => void
    ): void;
    shutdown(): Promise<void>;
  };
  private readonly config: Required<GracefulDegradationConfig>;
  private readonly queue: ReadableSpan[] = [];
  private isExporting = false;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    baseExporter: {
      export(
        spans: ReadableSpan[],
        resultCallback: (result: ExportResult) => void
      ): void;
      shutdown(): Promise<void>;
    },
    config?: GracefulDegradationConfig
  ) {
    this.baseExporter = baseExporter;
    this.config = {
      maxQueueSize: config?.maxQueueSize ?? 1000,
      onTracesDropped: config?.onTracesDropped ?? (() => {}),
      onExportError: config?.onExportError ?? (() => {}),
    };

    // Start periodic flush attempts
    this.startFlushInterval();
  }

  /**
   * Export spans with graceful degradation.
   *
   * @param spans - Spans to export
   * @param resultCallback - Callback to invoke with export result
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    // Try to export directly first
    this.baseExporter.export(spans, (result) => {
      if (result.code === ExportResultCode.SUCCESS) {
        // Success - invoke callback
        resultCallback(result);
        // Try to flush queue if there are pending spans
        if (this.queue.length > 0) {
          this.flushQueue();
        }
      } else {
        // Failure - queue spans for retry
        const logger = getObservabilitySdkLogger();
        logger.warn(
          `[LangWatch] Export failed, queueing ${spans.length} spans for retry`
        );

        this.queueSpans(spans);

        // Create error for callback
        const error = new ExportError(
          `Failed to export ${spans.length} spans`,
          result.error instanceof Error ? result.error : undefined
        );
        this.config.onExportError(error);

        // Still return success to prevent blocking
        resultCallback({ code: ExportResultCode.SUCCESS });
      }
    });
  }

  /**
   * Queue spans for later retry.
   *
   * @param spans - Spans to queue
   */
  private queueSpans(spans: ReadableSpan[]): void {
    const logger = getObservabilitySdkLogger();

    // Add spans to queue
    this.queue.push(...spans);

    // Check if queue exceeds limit
    if (this.queue.length > this.config.maxQueueSize) {
      const dropCount = this.queue.length - this.config.maxQueueSize;
      // Drop oldest spans (FIFO)
      this.queue.splice(0, dropCount);

      logger.warn(
        `[LangWatch] Queue overflow: dropped ${dropCount} oldest traces`
      );
      this.config.onTracesDropped(dropCount);
    }

    logger.debug(`[LangWatch] Queue size: ${this.queue.length}`);
  }

  /**
   * Attempt to flush queued spans.
   */
  private flushQueue(): void {
    if (this.isExporting || this.queue.length === 0) {
      return;
    }

    this.isExporting = true;
    const logger = getObservabilitySdkLogger();
    logger.debug(`[LangWatch] Attempting to flush ${this.queue.length} queued spans`);

    // Take all queued spans
    const spansToExport = this.queue.splice(0, this.queue.length);

    this.baseExporter.export(spansToExport, (result) => {
      this.isExporting = false;

      if (result.code === ExportResultCode.SUCCESS) {
        logger.info(
          `[LangWatch] Successfully flushed ${spansToExport.length} queued spans`
        );
      } else {
        // Re-queue failed spans
        logger.warn(
          `[LangWatch] Failed to flush queue, re-queueing ${spansToExport.length} spans`
        );
        this.queueSpans(spansToExport);
      }
    });
  }

  /**
   * Start periodic flush attempts.
   */
  private startFlushInterval(): void {
    // Try to flush queue every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushQueue();
    }, 30000);

    // Don't prevent process exit
    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }
  }

  /**
   * Stop periodic flush attempts.
   */
  private stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Shutdown the exporter and flush remaining spans.
   */
  async shutdown(): Promise<void> {
    this.stopFlushInterval();

    // Try to flush remaining spans
    if (this.queue.length > 0) {
      const logger = getObservabilitySdkLogger();
      logger.info(
        `[LangWatch] Shutting down with ${this.queue.length} queued spans, attempting final flush`
      );

      await new Promise<void>((resolve) => {
        const spansToExport = this.queue.splice(0, this.queue.length);
        this.baseExporter.export(spansToExport, () => {
          resolve();
        });
      });
    }

    await this.baseExporter.shutdown();
  }

  /**
   * Get current queue size.
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}
