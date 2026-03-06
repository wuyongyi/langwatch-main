import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GracefulExporter } from "../graceful-exporter";
import { ExportResultCode } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";

// Mock logger
vi.mock("../../config", () => ({
  getObservabilitySdkLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("given a graceful exporter", () => {
  let mockBaseExporter: {
    export: ReturnType<typeof vi.fn>;
    shutdown: ReturnType<typeof vi.fn>;
  };
  let mockSpan: ReadableSpan;

  beforeEach(() => {
    vi.useFakeTimers();

    mockBaseExporter = {
      export: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    mockSpan = {
      name: "test-span",
      spanContext: () => ({
        traceId: "trace-123",
        spanId: "span-456",
        traceFlags: 1,
      }),
    } as unknown as ReadableSpan;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when export succeeds", () => {
    it("invokes callback with success result", () => {
      const exporter = new GracefulExporter(mockBaseExporter);
      const callback = vi.fn();

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      exporter.export([mockSpan], callback);

      expect(callback).toHaveBeenCalledWith({
        code: ExportResultCode.SUCCESS,
      });
      expect(exporter.getQueueSize()).toBe(0);
    });

    it("does not queue spans", () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      exporter.export([mockSpan], () => {});

      expect(exporter.getQueueSize()).toBe(0);
    });
  });

  describe("when export fails", () => {
    it("queues spans for retry", () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], () => {});

      expect(exporter.getQueueSize()).toBe(1);
    });

    it("invokes callback with success to prevent blocking", () => {
      const exporter = new GracefulExporter(mockBaseExporter);
      const callback = vi.fn();

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], callback);

      expect(callback).toHaveBeenCalledWith({
        code: ExportResultCode.SUCCESS,
      });
    });

    it("invokes onExportError callback", () => {
      const onExportError = vi.fn();
      const exporter = new GracefulExporter(mockBaseExporter, {
        onExportError,
      });

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error("Network error"),
        });
      });

      exporter.export([mockSpan], () => {});

      expect(onExportError).toHaveBeenCalled();
      const error = onExportError.mock.calls[0]?.[0];
      expect(error?.message).toContain("Failed to export 1 spans");
    });
  });

  describe("when queue exceeds limit", () => {
    it("drops oldest spans (FIFO)", () => {
      const exporter = new GracefulExporter(mockBaseExporter, {
        maxQueueSize: 2,
      });

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      const span1 = { ...mockSpan, name: "span-1" } as ReadableSpan;
      const span2 = { ...mockSpan, name: "span-2" } as ReadableSpan;
      const span3 = { ...mockSpan, name: "span-3" } as ReadableSpan;

      exporter.export([span1], () => {});
      exporter.export([span2], () => {});
      exporter.export([span3], () => {});

      expect(exporter.getQueueSize()).toBe(2);
    });

    it("invokes onTracesDropped callback", () => {
      const onTracesDropped = vi.fn();
      const exporter = new GracefulExporter(mockBaseExporter, {
        maxQueueSize: 2,
        onTracesDropped,
      });

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], () => {});
      exporter.export([mockSpan], () => {});
      exporter.export([mockSpan], () => {});

      expect(onTracesDropped).toHaveBeenCalledWith(1);
    });

    it("drops multiple spans when batch exceeds limit", () => {
      const onTracesDropped = vi.fn();
      const exporter = new GracefulExporter(mockBaseExporter, {
        maxQueueSize: 2,
        onTracesDropped,
      });

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      const spans = [
        { ...mockSpan, name: "span-1" },
        { ...mockSpan, name: "span-2" },
        { ...mockSpan, name: "span-3" },
        { ...mockSpan, name: "span-4" },
      ] as ReadableSpan[];

      exporter.export(spans, () => {});

      expect(exporter.getQueueSize()).toBe(2);
      expect(onTracesDropped).toHaveBeenCalledWith(2);
    });
  });

  describe("when flushing queue", () => {
    it("attempts to flush after successful export", () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      // First export fails, queuing span
      mockBaseExporter.export.mockImplementationOnce((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], () => {});
      expect(exporter.getQueueSize()).toBe(1);

      // Second export succeeds
      mockBaseExporter.export.mockImplementationOnce((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      // This should trigger flush
      mockBaseExporter.export.mockImplementationOnce((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      const span2 = { ...mockSpan, name: "span-2" } as ReadableSpan;
      exporter.export([span2], () => {});

      // Queue should be flushed
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(3);
    });

    it("periodically attempts to flush queue", () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      // Queue some spans
      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], () => {});
      expect(exporter.getQueueSize()).toBe(1);

      // Clear the initial export call
      mockBaseExporter.export.mockClear();

      // Mock successful flush
      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Should have attempted flush
      expect(mockBaseExporter.export).toHaveBeenCalled();
      expect(exporter.getQueueSize()).toBe(0);
    });

    it("re-queues spans if flush fails", () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      // Queue some spans
      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], () => {});
      expect(exporter.getQueueSize()).toBe(1);

      // Advance time to trigger flush
      vi.advanceTimersByTime(30000);

      // Spans should still be queued
      expect(exporter.getQueueSize()).toBe(1);
    });
  });

  describe("when shutting down", () => {
    it("attempts to flush remaining spans", async () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      // Queue some spans
      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], () => {});
      expect(exporter.getQueueSize()).toBe(1);

      // Mock successful flush on shutdown
      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      await exporter.shutdown();

      expect(mockBaseExporter.shutdown).toHaveBeenCalled();
    });

    it("stops periodic flush interval", async () => {
      const exporter = new GracefulExporter(mockBaseExporter);

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      await exporter.shutdown();

      // Clear mock
      mockBaseExporter.export.mockClear();

      // Advance time
      vi.advanceTimersByTime(30000);

      // Should not attempt flush after shutdown
      expect(mockBaseExporter.export).not.toHaveBeenCalled();
    });
  });

  describe("when agent execution continues", () => {
    it("does not block agent even if export fails", () => {
      const exporter = new GracefulExporter(mockBaseExporter);
      const callback = vi.fn();

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      // This should not throw
      expect(() => {
        exporter.export([mockSpan], callback);
      }).not.toThrow();

      // Callback should still be invoked with success
      expect(callback).toHaveBeenCalledWith({
        code: ExportResultCode.SUCCESS,
      });
    });
  });
});
