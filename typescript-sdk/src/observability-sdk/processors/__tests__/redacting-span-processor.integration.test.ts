import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { RedactingBatchSpanProcessor } from "../redacting-batch-span-processor";
import { createDefaultRedactionRules } from "../redaction";
import * as intSemconv from "../../semconv/attributes";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";

// Helper to create a minimal ReadableSpan for testing
function createTestSpan(attributes: Record<string, any>): ReadableSpan {
  return {
    name: "test-span",
    kind: SpanKind.INTERNAL,
    spanContext: () => ({
      traceId: "00000000000000000000000000000001",
      spanId: "0000000000000001",
      traceFlags: 1,
    }),
    startTime: [Date.now(), 0],
    endTime: [Date.now() + 100, 0],
    status: { code: SpanStatusCode.OK },
    attributes,
    links: [],
    events: [],
    duration: [0, 100000000],
    ended: true,
    resource: {
      attributes: {},
    } as any,
    instrumentationLibrary: {
      name: "test",
      version: "1.0.0",
    },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  } as unknown as ReadableSpan;
}

describe("given RedactingBatchSpanProcessor", () => {
  let exportedSpans: ReadableSpan[];
  let mockExporter: SpanExporter;
  let processor: RedactingBatchSpanProcessor;

  beforeEach(() => {
    exportedSpans = [];
    mockExporter = {
      export: vi.fn((spans, callback) => {
        exportedSpans.push(...spans);
        callback({ code: 0 });
      }),
      shutdown: vi.fn(() => Promise.resolve()),
    };
    processor = new RedactingBatchSpanProcessor(
      mockExporter,
      createDefaultRedactionRules()
    );
  });

  describe("when span contains sensitive data in input", () => {
    it("redacts API keys before export", async () => {
      const span = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_INPUT]: JSON.stringify({
          type: "text",
          value: "My API key is sk-abc123",
        }),
      });

      processor.onEnd(span);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      const input = JSON.parse(exported!.attributes[intSemconv.ATTR_LANGWATCH_INPUT] as string);
      
      expect(input.value).toContain("***REDACTED***");
      expect(input.value).not.toContain("sk-abc123");
    });

    it("redacts Bearer tokens in output", async () => {
      const span = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_OUTPUT]: JSON.stringify({
          type: "text",
          value: "Token: Bearer secret123",
        }),
      });

      processor.onEnd(span);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      const output = JSON.parse(exported!.attributes[intSemconv.ATTR_LANGWATCH_OUTPUT] as string);
      
      expect(output.value).toContain("***REDACTED***");
      expect(output.value).not.toContain("secret123");
    });
  });

  describe("when span contains sensitive headers", () => {
    it("redacts Authorization headers", async () => {
      const span = createTestSpan({
        "http.request.headers": JSON.stringify({
          "Authorization": "Bearer secret-token-12345",
          "Content-Type": "application/json",
        }),
      });

      processor.onEnd(span);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      const headers = JSON.parse(exported!.attributes["http.request.headers"] as string);
      
      expect(headers["Authorization"]).toBe("[REDACTED]");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("redacts x-api-key headers", async () => {
      const span = createTestSpan({
        "http.request.headers": JSON.stringify({
          "x-api-key": "sk-1234567890abcdef",
          "Content-Type": "application/json",
        }),
      });

      processor.onEnd(span);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      const headers = JSON.parse(exported!.attributes["http.request.headers"] as string);
      
      expect(headers["x-api-key"]).toBe("[REDACTED]");
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("when span contains custom metadata", () => {
    it("preserves custom metadata during redaction", async () => {
      const span = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_INPUT]: JSON.stringify({
          type: "text",
          value: "API key: sk-abc123",
        }),
        "langwatch.metadata.environment": "production",
        "langwatch.metadata.retry_count": 3,
        "langwatch.metadata.is_test": false,
      });

      processor.onEnd(span);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      
      // Verify redaction happened
      const input = JSON.parse(exported!.attributes[intSemconv.ATTR_LANGWATCH_INPUT] as string);
      expect(input.value).toContain("***REDACTED***");
      
      // Verify metadata preserved
      expect(exported!.attributes["langwatch.metadata.environment"]).toBe("production");
      expect(exported!.attributes["langwatch.metadata.retry_count"]).toBe(3);
      expect(exported!.attributes["langwatch.metadata.is_test"]).toBe(false);
    });
  });

  describe("when span contains no sensitive data", () => {
    it("exports span unchanged", async () => {
      const span = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_INPUT]: JSON.stringify({
          type: "text",
          value: "Hello world, this is normal text",
        }),
        "langwatch.span.type": "llm",
      });

      processor.onEnd(span);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      const input = JSON.parse(exported!.attributes[intSemconv.ATTR_LANGWATCH_INPUT] as string);
      
      expect(input.value).toBe("Hello world, this is normal text");
      expect(exported!.attributes["langwatch.span.type"]).toBe("llm");
    });
  });

  describe("when span has nested parent-child relationships", () => {
    it("preserves span structure after redaction", async () => {
      const parentSpan = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_INPUT]: JSON.stringify({
          type: "text",
          value: "password=secret123",
        }),
      });

      const childSpan = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_INPUT]: JSON.stringify({
          type: "text",
          value: "Normal input",
        }),
      });

      processor.onEnd(parentSpan);
      processor.onEnd(childSpan);
      await processor.forceFlush();

      expect(exportedSpans).toHaveLength(2);
      
      // Verify parent span redacted
      const exportedParent = exportedSpans[0];
      expect(exportedParent).toBeDefined();
      const parentInput = JSON.parse(exportedParent!.attributes[intSemconv.ATTR_LANGWATCH_INPUT] as string);
      expect(parentInput.value).toContain("***REDACTED***");
      
      // Verify child span unchanged
      const exportedChild = exportedSpans[1];
      expect(exportedChild).toBeDefined();
      const childInput = JSON.parse(exportedChild!.attributes[intSemconv.ATTR_LANGWATCH_INPUT] as string);
      expect(childInput.value).toBe("Normal input");
      
      // Verify span IDs unchanged
      expect(exportedParent!.spanContext().spanId).toBe(parentSpan.spanContext().spanId);
      expect(exportedChild!.spanContext().spanId).toBe(childSpan.spanContext().spanId);
    });
  });

  describe("when using custom redaction rules", () => {
    it("applies custom rules in addition to defaults", async () => {
      const customRules = [
        ...createDefaultRedactionRules(),
        {
          name: "custom_secret",
          pattern: /secret-key-[a-z0-9]+/gi,
          replacement: "***REDACTED***",
        },
      ];

      const customProcessor = new RedactingBatchSpanProcessor(mockExporter, customRules);

      const span = createTestSpan({
        [intSemconv.ATTR_LANGWATCH_INPUT]: JSON.stringify({
          type: "text",
          value: "My secret-key-abc123 is here",
        }),
      });

      customProcessor.onEnd(span);
      await customProcessor.forceFlush();

      expect(exportedSpans).toHaveLength(1);
      const exported = exportedSpans[0];
      expect(exported).toBeDefined();
      const input = JSON.parse(exported!.attributes[intSemconv.ATTR_LANGWATCH_INPUT] as string);
      
      expect(input.value).toBe("My ***REDACTED*** is here");
    });
  });
});
