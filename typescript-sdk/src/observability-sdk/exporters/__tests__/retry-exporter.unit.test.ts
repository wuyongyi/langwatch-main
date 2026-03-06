import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RetryExporter, exportWithRetry } from "../retry-exporter";
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

describe("given a retry exporter", () => {
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

  describe("when export succeeds on first attempt", () => {
    it("invokes callback with success result", () => {
      const exporter = new RetryExporter(mockBaseExporter);
      const callback = vi.fn();

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      exporter.export([mockSpan], callback);

      expect(callback).toHaveBeenCalledWith({
        code: ExportResultCode.SUCCESS,
      });
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(1);
    });

    it("does not retry", () => {
      const exporter = new RetryExporter(mockBaseExporter);

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      exporter.export([mockSpan], () => {});

      expect(mockBaseExporter.export).toHaveBeenCalledTimes(1);
    });
  });

  describe("when export fails then succeeds", () => {
    it("retries with exponential backoff", () => {
      const exporter = new RetryExporter(mockBaseExporter, {
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });
      const callback = vi.fn();

      // First attempt fails
      mockBaseExporter.export.mockImplementationOnce((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      // Second attempt succeeds
      mockBaseExporter.export.mockImplementationOnce((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      exporter.export([mockSpan], callback);

      // First attempt should fail
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(1);
      expect(callback).not.toHaveBeenCalled();

      // Advance time by initial delay
      vi.advanceTimersByTime(100);

      // Second attempt should succeed
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith({
        code: ExportResultCode.SUCCESS,
      });
    });

    it("calculates delay with exponential backoff", () => {
      const exporter = new RetryExporter(mockBaseExporter, {
        initialDelayMs: 100,
        backoffMultiplier: 2,
        maxRetries: 3,
      });

      // All attempts fail except last
      mockBaseExporter.export
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.FAILED });
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.FAILED });
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.FAILED });
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.SUCCESS });
        });

      exporter.export([mockSpan], () => {});

      // First attempt
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(1);

      // Advance by 100ms (initial delay)
      vi.advanceTimersByTime(100);
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(2);

      // Advance by 200ms (100 * 2^1)
      vi.advanceTimersByTime(200);
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(3);

      // Advance by 400ms (100 * 2^2)
      vi.advanceTimersByTime(400);
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(4);
    });

    it("caps delay at maxDelayMs", () => {
      const exporter = new RetryExporter(mockBaseExporter, {
        initialDelayMs: 1000,
        backoffMultiplier: 10,
        maxDelayMs: 5000,
        maxRetries: 3,
      });

      mockBaseExporter.export
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.FAILED });
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.FAILED });
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.SUCCESS });
        });

      exporter.export([mockSpan], () => {});

      // First retry: 1000ms
      vi.advanceTimersByTime(1000);
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(2);

      // Second retry: should be capped at 5000ms (not 10000ms)
      vi.advanceTimersByTime(5000);
      expect(mockBaseExporter.export).toHaveBeenCalledTimes(3);
    });
  });

  describe("when all retries are exhausted", () => {
    it("invokes callback with failure result", () => {
      const exporter = new RetryExporter(mockBaseExporter, {
        maxRetries: 2,
        initialDelayMs: 100,
      });
      const callback = vi.fn();

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      exporter.export([mockSpan], callback);

      // Advance through all retries
      vi.advanceTimersByTime(100); // First retry
      vi.advanceTimersByTime(200); // Second retry

      expect(mockBaseExporter.export).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenCalledWith({
        code: ExportResultCode.FAILED,
      });
    });

    it("invokes onRetriesExhausted callback", () => {
      const onRetriesExhausted = vi.fn();
      const exporter = new RetryExporter(mockBaseExporter, {
        maxRetries: 1,
        initialDelayMs: 100,
        onRetriesExhausted,
      });

      mockBaseExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error("Network error"),
        });
      });

      exporter.export([mockSpan], () => {});

      // Advance through retry
      vi.advanceTimersByTime(100);

      expect(onRetriesExhausted).toHaveBeenCalled();
      const error = onRetriesExhausted.mock.calls[0]?.[0];
      expect(error?.message).toContain("Failed to export 1 spans after 2 attempts");
    });
  });

  describe("when shutting down", () => {
    it("calls base exporter shutdown", async () => {
      const exporter = new RetryExporter(mockBaseExporter);

      await exporter.shutdown();

      expect(mockBaseExporter.shutdown).toHaveBeenCalled();
    });
  });
});

describe("given exportWithRetry helper function", () => {
  let mockExporter: {
    export: ReturnType<typeof vi.fn>;
  };
  let mockSpan: ReadableSpan;

  beforeEach(() => {
    vi.useFakeTimers();

    mockExporter = {
      export: vi.fn(),
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
    it("resolves without retrying", async () => {
      mockExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      });

      await exportWithRetry(mockExporter, [mockSpan]);

      expect(mockExporter.export).toHaveBeenCalledTimes(1);
    });
  });

  describe("when export fails then succeeds", () => {
    it("retries and resolves", async () => {
      mockExporter.export
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.FAILED });
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.SUCCESS });
        });

      const promise = exportWithRetry(mockExporter, [mockSpan], {
        initialDelayMs: 100,
      });

      // Advance time to trigger retry
      await vi.advanceTimersByTimeAsync(100);

      await promise;

      expect(mockExporter.export).toHaveBeenCalledTimes(2);
    });
  });

  describe("when all retries are exhausted", () => {
    it("rejects with ExportError", async () => {
      mockExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      const promise = exportWithRetry(mockExporter, [mockSpan], {
        maxRetries: 1,
        initialDelayMs: 100,
      });

      // Advance through retry
      const advancePromise = vi.advanceTimersByTimeAsync(100);
      
      await expect(promise).rejects.toThrow("Failed to export 1 spans after 2 attempts");
      await advancePromise;
    });

    it("invokes onRetriesExhausted callback", async () => {
      const onRetriesExhausted = vi.fn();

      mockExporter.export.mockImplementation((spans, resultCallback) => {
        resultCallback({ code: ExportResultCode.FAILED });
      });

      const promise = exportWithRetry(mockExporter, [mockSpan], {
        maxRetries: 1,
        initialDelayMs: 100,
        onRetriesExhausted,
      });

      // Advance through retry
      const advancePromise = vi.advanceTimersByTimeAsync(100);

      await expect(promise).rejects.toThrow();
      await advancePromise;
      expect(onRetriesExhausted).toHaveBeenCalled();
    });
  });

  describe("when exporter throws error", () => {
    it("retries on thrown errors", async () => {
      mockExporter.export
        .mockImplementationOnce(() => {
          throw new Error("Network error");
        })
        .mockImplementationOnce((spans, resultCallback) => {
          resultCallback({ code: ExportResultCode.SUCCESS });
        });

      const promise = exportWithRetry(mockExporter, [mockSpan], {
        initialDelayMs: 100,
      });

      // Advance time to trigger retry
      await vi.advanceTimersByTimeAsync(100);

      await promise;

      expect(mockExporter.export).toHaveBeenCalledTimes(2);
    });

    it("rejects after max retries on thrown errors", async () => {
      mockExporter.export.mockImplementation(() => {
        throw new Error("Network error");
      });

      const promise = exportWithRetry(mockExporter, [mockSpan], {
        maxRetries: 1,
        initialDelayMs: 100,
      });

      // Advance through retry
      const advancePromise = vi.advanceTimersByTimeAsync(100);

      await expect(promise).rejects.toThrow("Failed to export 1 spans after 2 attempts");
      await advancePromise;
    });
  });
});
