/**
 * Unit tests for sampling metadata processor.
 * 
 * Tests that sampling metadata is correctly added to spans.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SamplingMetadataProcessor } from "../sampling-metadata-processor";
import { type Span as ApiSpan, SpanKind, SpanStatusCode, TraceFlags } from "@opentelemetry/api";
import { type Span as SdkSpan } from "@opentelemetry/sdk-trace-base";
import { context } from "@opentelemetry/api";

// Helper to create a mock span for testing
function createMockSpan(traceFlags: number = TraceFlags.SAMPLED): SdkSpan {
  const attributes: Record<string, any> = {};
  
  const mockSpan: any = {
    spanContext: () => ({
      traceId: "00000000000000000000000000000001",
      spanId: "0000000000000001",
      traceFlags,
    }),
    setAttribute: vi.fn((key: string, value: any) => {
      attributes[key] = value;
      return mockSpan;
    }),
    setAttributes: vi.fn((attrs: Record<string, any>) => {
      Object.assign(attributes, attrs);
      return mockSpan;
    }),
    addEvent: vi.fn(),
    setStatus: vi.fn(),
    updateName: vi.fn(),
    end: vi.fn(),
    isRecording: () => true,
    recordException: vi.fn(),
    _getAttributes: () => attributes, // Helper for testing
  };
  
  return mockSpan as SdkSpan;
}

describe("given a sampling metadata processor", () => {
  describe("when sampling rate is 0.5", () => {
    it("adds sampling rate to span attributes", () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 0.5 });
      const span = createMockSpan(TraceFlags.SAMPLED);
      
      processor.onStart(span, context.active());
      
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.rate", 0.5);
    });

    it("adds sampled flag to span attributes", () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 0.5 });
      const span = createMockSpan(TraceFlags.SAMPLED);
      
      processor.onStart(span, context.active());
      
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.sampled", true);
    });
  });

  describe("when sampling rate is 1.0", () => {
    it("marks sampled spans correctly", () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 1.0 });
      const span = createMockSpan(TraceFlags.SAMPLED);
      
      processor.onStart(span, context.active());
      
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.rate", 1.0);
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.sampled", true);
    });
  });

  describe("when sampling rate is 0.0", () => {
    it("adds sampling rate even for unsampled traces", () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 0.0 });
      const span = createMockSpan(TraceFlags.NONE);
      
      processor.onStart(span, context.active());
      
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.rate", 0.0);
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.sampled", false);
    });
  });

  describe("when span is not sampled", () => {
    it("marks sampled flag as false", () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 0.5 });
      const span = createMockSpan(TraceFlags.NONE);
      
      processor.onStart(span, context.active());
      
      expect(span.setAttribute).toHaveBeenCalledWith("langwatch.sampling.sampled", false);
    });
  });

  describe("when shutting down", () => {
    it("completes shutdown successfully", async () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 0.5 });
      
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("when force flushing", () => {
    it("completes flush successfully", async () => {
      const processor = new SamplingMetadataProcessor({ samplingRate: 0.5 });
      
      await expect(processor.forceFlush()).resolves.toBeUndefined();
    });
  });
});
