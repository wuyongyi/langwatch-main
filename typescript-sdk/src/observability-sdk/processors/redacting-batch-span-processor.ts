/**
 * Redacting Batch Span Processor for OpenTelemetry
 *
 * This module provides a BatchSpanProcessor that automatically redacts sensitive data
 * from span attributes before export. It applies pattern-based redaction rules to
 * inputs, outputs, and HTTP headers.
 *
 * @module redacting-batch-span-processor
 */

import {
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
  type BufferConfig,
} from "@opentelemetry/sdk-trace-base";
import {
  type RedactionRule,
  applyRedaction,
  redactHeaders,
} from "./redaction";

/**
 * A BatchSpanProcessor that redacts sensitive data from spans before export.
 *
 * This processor applies redaction rules to:
 * - langwatch.input: Span input data
 * - langwatch.output: Span output data
 * - http.request.headers: HTTP request headers
 * - http.response.headers: HTTP response headers
 *
 * All other attributes are passed through unchanged.
 *
 * @example
 * import { RedactingBatchSpanProcessor } from './redacting-batch-span-processor';
 * import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
 * import { createDefaultRedactionRules } from './redaction';
 *
 * const exporter = new OTLPTraceExporter({ url: '...' });
 * const rules = createDefaultRedactionRules();
 * provider.addSpanProcessor(new RedactingBatchSpanProcessor(exporter, rules));
 */
export class RedactingBatchSpanProcessor extends BatchSpanProcessor {
  private readonly _redactionRules: RedactionRule[];

  /**
   * Create a new RedactingBatchSpanProcessor.
   *
   * @param exporter - The underlying SpanExporter to use for exporting spans.
   * @param redactionRules - Array of redaction rules to apply to span data.
   * @param config - Optional buffer configuration for the batch processor.
   */
  constructor(
    exporter: SpanExporter,
    redactionRules: RedactionRule[],
    config?: BufferConfig
  ) {
    // Wrap the exporter to apply redaction before export
    const redactingExporter: SpanExporter = {
      export: (spans, resultCallback) => {
        const redactedSpans = spans.map(span => this._redactSpan(span));
        return exporter.export(redactedSpans, resultCallback);
      },
      shutdown: () => exporter.shutdown(),
    };

    super(redactingExporter, config);
    this._redactionRules = redactionRules;
  }

  /**
   * Redacts sensitive data from a span.
   *
   * @param span - The ReadableSpan to redact
   * @returns A new ReadableSpan with redacted attributes
   */
  private _redactSpan(span: ReadableSpan): ReadableSpan {
    // Apply redaction to span attributes
    let redactedAttributes = applyRedaction(span.attributes, this._redactionRules);

    // Apply header redaction to HTTP headers
    redactedAttributes = this._redactHttpHeaders(redactedAttributes);

    // Return a new span object with redacted attributes
    return {
      ...span,
      attributes: redactedAttributes,
    };
  }

  /**
   * Redacts sensitive HTTP headers from span attributes.
   *
   * @param attributes - The span attributes
   * @returns Attributes with redacted headers
   */
  private _redactHttpHeaders(attributes: Record<string, any>): Record<string, any> {
    const redacted = { ...attributes };

    // Redact request headers
    if (redacted["http.request.headers"]) {
      try {
        const headers = typeof redacted["http.request.headers"] === "string"
          ? JSON.parse(redacted["http.request.headers"])
          : redacted["http.request.headers"];
        
        const redactedHeaders = redactHeaders(headers);
        redacted["http.request.headers"] = typeof redacted["http.request.headers"] === "string"
          ? JSON.stringify(redactedHeaders)
          : redactedHeaders;
      } catch {
        // If parsing fails, leave as-is
      }
    }

    // Redact response headers
    if (redacted["http.response.headers"]) {
      try {
        const headers = typeof redacted["http.response.headers"] === "string"
          ? JSON.parse(redacted["http.response.headers"])
          : redacted["http.response.headers"];
        
        const redactedHeaders = redactHeaders(headers);
        redacted["http.response.headers"] = typeof redacted["http.response.headers"] === "string"
          ? JSON.stringify(redactedHeaders)
          : redactedHeaders;
      } catch {
        // If parsing fails, leave as-is
      }
    }

    return redacted;
  }
}
