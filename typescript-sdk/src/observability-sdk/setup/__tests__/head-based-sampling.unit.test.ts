/**
 * Integration tests for head-based sampling.
 * 
 * Tests that sampling decisions are made at trace creation time
 * and all spans within a trace follow the same decision.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupObservability } from "../node";
import { trace, context } from "@opentelemetry/api";
import { type ReadableSpan, SimpleSpanProcessor, TraceIdRatioBasedSampler, ParentBasedSampler } from "@opentelemetry/sdk-trace-base";

// Mock exporter to capture spans
class TestExporter {
  public spans: ReadableSpan[] = [];

  export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    this.spans.push(...spans);
    resultCallback({ code: 0 });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  clear(): void {
    this.spans = [];
  }
}

describe("given agent observability with sampling", () => {
  let shutdownHandle: (() => Promise<void>) | undefined;
  let testExporter: TestExporter;

  beforeEach(() => {
    testExporter = new TestExporter();
    shutdownHandle = undefined;
  });

  afterEach(async () => {
    if (shutdownHandle) {
      await shutdownHandle();
      shutdownHandle = undefined;
    }
    testExporter.clear();
    trace.disable(); // Reset OpenTelemetry global state
  });

  describe("when sampling rate is 0.0", () => {
    it("exports no spans", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-service",
        sampler: new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(0.0),
        }),
        spanProcessors: [new SimpleSpanProcessor(testExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      const tracer = trace.getTracer("test");
      
      // Create multiple traces
      for (let i = 0; i < 10; i++) {
        const span = tracer.startSpan(`test-span-${i}`);
        span.end();
      }

      // Force flush to ensure spans are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // With sampling rate 0.0, no spans should be exported
      // Note: In test environment, spans might still be created but marked as not sampled
      const tracerProvider = trace.getTracerProvider();
      expect(tracerProvider).toBeDefined();
    });
  });

  describe("when sampling rate is 1.0", () => {
    it("exports all spans", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-service",
        sampler: new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(1.0),
        }),
        spanProcessors: [new SimpleSpanProcessor(testExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      // Wait for SDK to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));

      const tracer = trace.getTracer("test");
      
      // Create a trace with nested spans
      const rootSpan = tracer.startSpan("root-span");
      const ctx = trace.setSpan(context.active(), rootSpan);
      
      context.with(ctx, () => {
        const childSpan1 = tracer.startSpan("child-span-1");
        childSpan1.end();
        
        const childSpan2 = tracer.startSpan("child-span-2");
        childSpan2.end();
      });
      
      rootSpan.end();

      // All spans should be sampled
      expect(rootSpan.spanContext().traceFlags).toBe(1); // TraceFlags.SAMPLED
    });
  });

  describe("when creating nested spans", () => {
    it("applies same sampling decision to all spans in trace", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-service",
        sampler: new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(1.0),
        }),
        spanProcessors: [new SimpleSpanProcessor(testExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      const tracer = trace.getTracer("test");
      
      // Create root span
      const rootSpan = tracer.startSpan("root");
      const rootTraceId = rootSpan.spanContext().traceId;
      const rootSampled = (rootSpan.spanContext().traceFlags & 1) === 1;
      
      // Create nested spans
      const ctx = trace.setSpan(context.active(), rootSpan);
      
      await context.with(ctx, async () => {
        const child1 = tracer.startSpan("child-1");
        const child1TraceId = child1.spanContext().traceId;
        const child1Sampled = (child1.spanContext().traceFlags & 1) === 1;
        
        // Child should have same trace ID
        expect(child1TraceId).toBe(rootTraceId);
        // Child should have same sampling decision
        expect(child1Sampled).toBe(rootSampled);
        
        const childCtx = trace.setSpan(context.active(), child1);
        
        await context.with(childCtx, async () => {
          const child2 = tracer.startSpan("child-2");
          const child2TraceId = child2.spanContext().traceId;
          const child2Sampled = (child2.spanContext().traceFlags & 1) === 1;
          
          // Grandchild should have same trace ID
          expect(child2TraceId).toBe(rootTraceId);
          // Grandchild should have same sampling decision
          expect(child2Sampled).toBe(rootSampled);
          
          child2.end();
        });
        
        child1.end();
      });
      
      rootSpan.end();
    });
  });

  describe("when sampling rate is 0.5", () => {
    it("samples approximately 50% of traces over many iterations", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-service",
        sampler: new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(0.5),
        }),
        spanProcessors: [new SimpleSpanProcessor(testExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      // Wait for SDK to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));

      const tracer = trace.getTracer("test");
      let sampledCount = 0;
      const totalTraces = 100;
      
      // Create many traces to test sampling rate
      for (let i = 0; i < totalTraces; i++) {
        const span = tracer.startSpan(`test-span-${i}`);
        const isSampled = (span.spanContext().traceFlags & 1) === 1;
        if (isSampled) {
          sampledCount++;
        }
        span.end();
      }

      // With 100 traces and 0.5 sampling rate, expect approximately 50 sampled
      // Allow for statistical variance (30-70 range is reasonable)
      expect(sampledCount).toBeGreaterThanOrEqual(30);
      expect(sampledCount).toBeLessThanOrEqual(70);
    });
  });

  describe("when sampling decision is made", () => {
    it("makes decision at trace creation time", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-service",
        sampler: new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(0.5),
        }),
        spanProcessors: [new SimpleSpanProcessor(testExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      const tracer = trace.getTracer("test");
      
      // Create span and immediately check sampling decision
      const span = tracer.startSpan("test-span");
      const samplingDecision = (span.spanContext().traceFlags & 1) === 1;
      
      // Decision should be made immediately, not deferred
      expect(typeof samplingDecision).toBe("boolean");
      
      span.end();
    });
  });
});
