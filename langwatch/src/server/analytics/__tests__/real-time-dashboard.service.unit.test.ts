/**
 * Real-Time Dashboard Metrics Service Unit Tests
 * 
 * Tests for real-time dashboard metrics including:
 * - Current requests per minute calculation
 * - Current error rate calculation
 * - Current average latency calculation
 * - Recent traces retrieval with status indicators
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClickHouseClient } from "@clickhouse/client";
import { RealTimeDashboardService } from "../real-time-dashboard.service";

// Mock ClickHouse client
const mockClickHouseClient = {
  query: vi.fn(),
} as unknown as ClickHouseClient;

// Mock getClickHouseClient
vi.mock("~/server/clickhouse/client", () => ({
  getClickHouseClient: vi.fn(() => mockClickHouseClient),
}));

// Mock logger
vi.mock("~/utils/logger/server", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Mock tracer
vi.mock("langwatch", () => ({
  getLangWatchTracer: vi.fn(() => ({
    withActiveSpan: vi.fn((name, options, callback) => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setAttributes: vi.fn(),
      };
      return callback(mockSpan);
    }),
  })),
}));

describe("given a RealTimeDashboardService", () => {
  let service: RealTimeDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RealTimeDashboardService();
  });

  describe("when calculating current requests per minute", () => {
    it("calculates requests per minute from last minute", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            requestCount: "120",
          },
        ]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getCurrentRequestsPerMinute({
        projectId,
        currentTime: now,
      });

      expect(result.requestsPerMinute).toBe(120);
      expect(result.timestamp).toEqual(now);
      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining("count() AS requestCount"),
          query_params: expect.objectContaining({
            projectId,
            startTime: expect.any(String),
            endTime: now.toISOString(),
          }),
        })
      );
    });

    it("returns zero when no requests in last minute", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getCurrentRequestsPerMinute({
        projectId,
        currentTime: now,
      });

      expect(result.requestsPerMinute).toBe(0);
    });
  });

  describe("when calculating current error rate", () => {
    it("calculates error rate as percentage", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            totalRequests: "100",
            errorCount: "5",
            errorRate: 5.0,
          },
        ]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getCurrentErrorRate({
        projectId,
        currentTime: now,
        timeWindowMinutes: 5,
      });

      expect(result.errorRate).toBe(5.0);
      expect(result.totalRequests).toBe(100);
      expect(result.errorCount).toBe(5);
      expect(result.timestamp).toEqual(now);
    });

    it("returns zero error rate when no requests", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getCurrentErrorRate({
        projectId,
        currentTime: now,
        timeWindowMinutes: 5,
      });

      expect(result.errorRate).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.errorCount).toBe(0);
    });
  });

  describe("when calculating current average latency", () => {
    it("calculates average latency in milliseconds", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            avgLatency: 250.5,
            requestCount: "50",
          },
        ]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getCurrentAverageLatency({
        projectId,
        currentTime: now,
        timeWindowMinutes: 5,
      });

      expect(result.averageLatency).toBe(250.5);
      expect(result.requestCount).toBe(50);
      expect(result.timestamp).toEqual(now);
    });

    it("returns zero when no requests with latency data", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getCurrentAverageLatency({
        projectId,
        currentTime: now,
        timeWindowMinutes: 5,
      });

      expect(result.averageLatency).toBe(0);
      expect(result.requestCount).toBe(0);
    });
  });

  describe("when retrieving recent traces", () => {
    it("returns recent traces with status indicators", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            traceId: "trace-1",
            occurredAt: "2024-01-15T10:29:50Z",
            errorState: false,
            totalDurationMs: 150.5,
            totalCost: 0.0025,
          },
          {
            traceId: "trace-2",
            occurredAt: "2024-01-15T10:29:45Z",
            errorState: true,
            totalDurationMs: 200.0,
            totalCost: 0.0015,
          },
        ]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      const result = await service.getRecentTraces({
        projectId,
        currentTime: now,
        limit: 10,
      });

      expect(result.traces).toHaveLength(2);
      expect(result.traces[0]).toEqual({
        traceId: "trace-1",
        occurredAt: new Date("2024-01-15T10:29:50Z"),
        status: "success",
        durationMs: 150.5,
        cost: 0.0025,
      });
      expect(result.traces[1]).toEqual({
        traceId: "trace-2",
        occurredAt: new Date("2024-01-15T10:29:45Z"),
        status: "error",
        durationMs: 200.0,
        cost: 0.0015,
      });
    });

    it("limits results to specified limit", async () => {
      const projectId = "test-project-1";
      const now = new Date("2024-01-15T10:30:00Z");

      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(mockClickHouseClient.query).mockResolvedValue(
        mockResult as any
      );

      await service.getRecentTraces({
        projectId,
        currentTime: now,
        limit: 20,
      });

      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: expect.objectContaining({
            limit: 20,
          }),
        })
      );
    });
  });

  describe("when ClickHouse client is not available", () => {
    it("throws error for requests per minute", async () => {
      const { getClickHouseClient } = await import("~/server/clickhouse/client");
      vi.mocked(getClickHouseClient).mockReturnValueOnce(null);

      const serviceWithoutCH = new RealTimeDashboardService();

      await expect(
        serviceWithoutCH.getCurrentRequestsPerMinute({
          projectId: "test",
          currentTime: new Date(),
        })
      ).rejects.toThrow("ClickHouse client not available");
    });
  });
});
