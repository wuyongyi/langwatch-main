/**
 * Span processor that adds sampling metadata to traces.
 * 
 * This processor adds sampling rate and sampling decision metadata
 * to all spans, allowing analytics to account for sampling when
 * calculating metrics.
 */

import {
  type Span,
  type SpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { type Context } from "@opentelemetry/api";

export interface SamplingMetadataConfig {
  /** The configured sampling rate (0.0 to 1.0) */
  samplingRate: number;
}

/**
 * Span processor that adds sampling metadata to spans.
 * 
 * This processor adds the following attributes to each span:
 * - langwatch.sampling.rate: The configured sampling rate
 * - langwatch.sampling.sampled: Whether this trace was sampled
 * 
 * @example
 * ```typescript
 * import { SamplingMetadataProcessor } from "langwatch/observability";
 * import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
 * 
 * const processor = new SamplingMetadataProcessor({ samplingRate: 0.5 });
 * tracerProvider.addSpanProcessor(processor);
 * ```
 */
export class SamplingMetadataProcessor implements SpanProcessor {
  constructor(private config: SamplingMetadataConfig) {}

  onStart(span: Span, parentContext: Context): void {
    // Add sampling rate to all spans
    span.setAttribute("langwatch.sampling.rate", this.config.samplingRate);
    
    // Check if span is sampled by examining trace flags
    // TraceFlags.SAMPLED = 0x01
    const isSampled = (span.spanContext().traceFlags & 0x01) === 0x01;
    span.setAttribute("langwatch.sampling.sampled", isSampled);
  }

  onEnd(span: ReadableSpan): void {
    // No action needed on end
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
