/**
 * Unit tests for Agent Metrics Service
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AgentMetricsService } from "../agent-metrics.service";
import type { ClickHouseClient } from "@clickhouse/client";
import { getClickHouseClient } from "~/server/clickhouse/client";

// Mock dependencies
vi.mock("~/server/clickhouse/client", () => ({
  getClickHouseClient: vi.fn(),
}));

vi.mock("../../../utils/logger/server", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock("langwatch", () => ({
  getLangWatchTracer: vi.fn(() => ({
    withActiveSpan: vi.fn((name, options, callback) => {
      const mockSpan = {
        setAttribute: vi.fn(),
      };
      if (typeof options === "function") {
        return options(mockSpan);
      }
      return callback(mockSpan);
    }),
  })),
}));

describe("given an AgentMetricsService", () => {
  let service: AgentMetricsService;
  let mockClickHouseClient: {
    query: Mock;
  };

  beforeEach(() => {
    mockClickHouseClient = {
      query: vi.fn(),
    };

    vi.mocked(getClickHouseClient).mockReturnValue(mockClickHouseClient as any);

    service = new AgentMetricsService();
  });

  describe("when checking availability", () => {
    it("returns true when ClickHouse client is available", () => {
      expect(service.isAvailable()).toBe(true);
    });

    it("returns false when ClickHouse client is not available", () => {
      vi.mocked(getClickHouseClient).mockReturnValue(null);

      const serviceWithoutClient = new AgentMetricsService();
      expect(serviceWithoutClient.isAvailable()).toBe(false);
    });
  });

  describe("when aggregating cost", () => {
    it("aggregates cost by time period", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            totalCost: 1.5,
            promptTokensCost: 0.5,
            completionTokensCost: 1.0,
            traceCount: 10,
          },
          {
            period: "2024-01-02",
            totalCost: 2.3,
            promptTokensCost: 0.8,
            completionTokensCost: 1.5,
            traceCount: 15,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "day",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        period: "2024-01-01",
        totalCost: 1.5,
        promptTokensCost: 0.5,
        completionTokensCost: 1.0,
        traceCount: 10,
      });
      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "JSONEachRow",
        })
      );
    });

    it("filters by user ID when provided", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        userId: "user-123",
      });

      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: expect.objectContaining({
            userId: "user-123",
          }),
        })
      );
    });

    it("filters by task type when provided", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        taskType: "code-generation",
      });

      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: expect.objectContaining({
            taskType: "code-generation",
          }),
        })
      );
    });

    it("throws error when ClickHouse client is not available", async () => {
      vi.mocked(getClickHouseClient).mockReturnValue(null);

      const serviceWithoutClient = new AgentMetricsService();

      await expect(
        serviceWithoutClient.aggregateCost({
          projectId: "test-project",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-03"),
        })
      ).rejects.toThrow("ClickHouse client not available");
    });
  });

  describe("when aggregating token usage", () => {
    it("aggregates token usage by time period", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            totalTokens: 5000,
            promptTokens: 2000,
            completionTokens: 3000,
            traceCount: 10,
          },
          {
            period: "2024-01-02",
            totalTokens: 7500,
            promptTokens: 3000,
            completionTokens: 4500,
            traceCount: 15,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.aggregateTokenUsage({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "day",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        period: "2024-01-01",
        totalTokens: 5000,
        promptTokens: 2000,
        completionTokens: 3000,
        traceCount: 10,
      });
    });

    it("handles string token counts from ClickHouse", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            totalTokens: "5000",
            promptTokens: "2000",
            completionTokens: "3000",
            traceCount: "10",
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.aggregateTokenUsage({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]).toEqual({
        period: "2024-01-01",
        totalTokens: 5000,
        promptTokens: 2000,
        completionTokens: 3000,
        traceCount: 10,
      });
    });
  });

  describe("when calculating error rate", () => {
    it("calculates error rate as percentage", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            totalExecutions: 100,
            errorCount: 5,
            errorRate: 5.0,
          },
          {
            period: "2024-01-02",
            totalExecutions: 150,
            errorCount: 15,
            errorRate: 10.0,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.calculateErrorRate({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "day",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        period: "2024-01-01",
        totalExecutions: 100,
        errorCount: 5,
        errorRate: 5.0,
      });
      expect(result[1]).toEqual({
        period: "2024-01-02",
        totalExecutions: 150,
        errorCount: 15,
        errorRate: 10.0,
      });
    });

    it("handles zero executions gracefully", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            totalExecutions: 0,
            errorCount: 0,
            errorRate: 0,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.calculateErrorRate({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.errorRate).toBe(0);
    });
  });

  describe("when calculating latency percentiles", () => {
    it("calculates p50, p95, p99 percentiles", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            p50: 150.5,
            p95: 450.2,
            p99: 890.7,
            avgLatency: 200.3,
            traceCount: 100,
          },
          {
            period: "2024-01-02",
            p50: 180.3,
            p95: 520.8,
            p99: 950.1,
            avgLatency: 230.5,
            traceCount: 150,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.calculateLatencyPercentiles({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "day",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        period: "2024-01-01",
        p50: 150.5,
        p95: 450.2,
        p99: 890.7,
        avgLatency: 200.3,
        traceCount: 100,
      });
    });

    it("filters out null duration values", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            p50: 150.5,
            p95: 450.2,
            p99: 890.7,
            avgLatency: 200.3,
            traceCount: 50,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.calculateLatencyPercentiles({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("ts.TotalDurationMs IS NOT NULL");
    });
  });

  describe("when using different time periods", () => {
    it("uses hourly grouping for hour period", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "hour",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("toStartOfHour");
    });

    it("uses daily grouping for day period", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "day",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("toStartOfDay");
    });

    it("uses weekly grouping for week period", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        timePeriod: "week",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("toStartOfWeek");
    });

    it("uses monthly grouping for month period", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.aggregateCost({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        timePeriod: "month",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("toStartOfMonth");
    });
  });

  describe("when grouping errors by type", () => {
    it("groups errors by error type with frequency counts", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "rate_limit",
            count: 50,
            firstSeen: "2024-01-01T10:00:00.000Z",
            lastSeen: "2024-01-02T15:30:00.000Z",
          },
          {
            errorType: "timeout",
            count: 30,
            firstSeen: "2024-01-01T11:00:00.000Z",
            lastSeen: "2024-01-02T14:00:00.000Z",
          },
          {
            errorType: "auth_error",
            count: 20,
            firstSeen: "2024-01-01T12:00:00.000Z",
            lastSeen: "2024-01-02T13:00:00.000Z",
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.groupErrorsByType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        errorType: "rate_limit",
        count: 50,
        percentage: 50,
        firstSeen: new Date("2024-01-01T10:00:00.000Z"),
        lastSeen: new Date("2024-01-02T15:30:00.000Z"),
      });
      expect(result[1]).toEqual({
        errorType: "timeout",
        count: 30,
        percentage: 30,
        firstSeen: new Date("2024-01-01T11:00:00.000Z"),
        lastSeen: new Date("2024-01-02T14:00:00.000Z"),
      });
      expect(result[2]).toEqual({
        errorType: "auth_error",
        count: 20,
        percentage: 20,
        firstSeen: new Date("2024-01-01T12:00:00.000Z"),
        lastSeen: new Date("2024-01-02T13:00:00.000Z"),
      });
    });

    it("handles string count values from ClickHouse", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "rate_limit",
            count: "50",
            firstSeen: "2024-01-01T10:00:00.000Z",
            lastSeen: "2024-01-02T15:30:00.000Z",
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.groupErrorsByType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.count).toBe(50);
      expect(result[0]?.percentage).toBe(100);
    });

    it("filters by user ID when provided", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.groupErrorsByType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        userId: "user-123",
      });

      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: expect.objectContaining({
            userId: "user-123",
          }),
        })
      );
    });

    it("queries stored_spans with error status code", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.groupErrorsByType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("stored_spans");
      expect(queryCall?.query).toContain("StatusCode = 2");
    });
  });

  describe("when analyzing error patterns", () => {
    it("analyzes error patterns with sample messages", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "rate_limit",
            count: 50,
            sampleMessages: [
              "Rate limit exceeded for API calls",
              "Rate limit: too many requests",
              "API rate limit reached",
            ],
          },
          {
            errorType: "timeout",
            count: 30,
            sampleMessages: [
              "Request timeout after 30s",
              "Connection timed out",
            ],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.analyzeErrorPatterns({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.errorType).toBe("rate_limit");
      expect(result[0]?.count).toBe(50);
      expect(result[0]?.percentage).toBe(62.5);
      expect(result[0]?.sampleMessages).toEqual([
        "Rate limit exceeded for API calls",
        "Rate limit: too many requests",
        "API rate limit reached",
      ]);
      expect(result[0]?.commonPatterns).toContain("Rate limit exceeded");
      
      expect(result[1]?.errorType).toBe("timeout");
      expect(result[1]?.count).toBe(30);
      expect(result[1]?.percentage).toBe(37.5);
      expect(result[1]?.sampleMessages).toEqual([
        "Request timeout after 30s",
        "Connection timed out",
      ]);
      expect(result[1]?.commonPatterns).toContain("Timeout");
    });

    it("identifies common error patterns from messages", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "api_error",
            count: 100,
            sampleMessages: [
              "Authentication failed: invalid token",
              "Unauthorized access denied",
              "Auth error: token expired",
              "Permission denied: insufficient privileges",
              "Authorization failed",
            ],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.analyzeErrorPatterns({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.commonPatterns).toContain("Authentication/Authorization");
      expect(result[0]?.commonPatterns).toContain("Permission denied");
    });

    it("filters out empty error messages", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "unknown",
            count: 10,
            sampleMessages: [
              "Valid error message",
              "",
              "   ",
              "Another valid message",
              "",
            ],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.analyzeErrorPatterns({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.sampleMessages).toEqual([
        "Valid error message",
        "Another valid message",
      ]);
    });

    it("limits sample messages to 5", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "error",
            count: 100,
            sampleMessages: [
              "Error 1",
              "Error 2",
              "Error 3",
              "Error 4",
              "Error 5",
              "Error 6",
              "Error 7",
            ],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.analyzeErrorPatterns({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.sampleMessages).toHaveLength(5);
    });

    it("returns empty patterns when no messages provided", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "unknown",
            count: 10,
            sampleMessages: [],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.analyzeErrorPatterns({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.commonPatterns).toEqual([]);
    });

    it("identifies multiple pattern types in messages", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            errorType: "mixed",
            count: 100,
            sampleMessages: [
              "Rate limit exceeded",
              "Connection timeout",
              "Rate limit reached",
              "Network connection failed",
              "Timeout error",
            ],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.analyzeErrorPatterns({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.commonPatterns).toContain("Rate limit exceeded");
      expect(result[0]?.commonPatterns).toContain("Timeout");
      expect(result[0]?.commonPatterns).toContain("Connection error");
    });
  });

  describe("when calculating latency by skill type", () => {
    it("calculates latency breakdown by skill type", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            skillType: "agent_skill",
            avgLatency: 250.5,
            p50: 200.0,
            p95: 450.0,
            p99: 600.0,
            spanCount: 50,
          },
          {
            skillType: "llm",
            avgLatency: 1200.3,
            p50: 1000.0,
            p95: 2000.0,
            p99: 3000.0,
            spanCount: 100,
          },
          {
            skillType: "tool",
            avgLatency: 150.2,
            p50: 120.0,
            p95: 300.0,
            p99: 400.0,
            spanCount: 75,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.calculateLatencyBySkillType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        skillType: "agent_skill",
        avgLatency: 250.5,
        p50: 200.0,
        p95: 450.0,
        p99: 600.0,
        spanCount: 50,
      });
      expect(result[1]?.skillType).toBe("llm");
      expect(result[2]?.skillType).toBe("tool");
    });

    it("filters by user ID when provided", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.calculateLatencyBySkillType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        userId: "user-123",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("langwatch.user_id");
      expect(queryCall?.query_params).toHaveProperty("userId", "user-123");
    });

    it("orders results by average latency descending", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.calculateLatencyBySkillType({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("ORDER BY avgLatency DESC");
    });
  });

  describe("when identifying slowest operations", () => {
    it("identifies slowest operations with default limit", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            spanName: "generate_code",
            spanType: "agent_skill",
            avgLatency: 5000.5,
            maxLatency: 8000.0,
            spanCount: 25,
            traceIds: ["trace-1", "trace-2", "trace-3"],
          },
          {
            spanName: "claude_api_call",
            spanType: "llm",
            avgLatency: 3500.2,
            maxLatency: 6000.0,
            spanCount: 50,
            traceIds: ["trace-4", "trace-5"],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.identifySlowestOperations({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        spanName: "generate_code",
        spanType: "agent_skill",
        avgLatency: 5000.5,
        maxLatency: 8000.0,
        spanCount: 25,
        traceIds: ["trace-1", "trace-2", "trace-3"],
      });
    });

    it("respects custom limit parameter", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.identifySlowestOperations({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        limit: 5,
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("LIMIT {limit:UInt32}");
      expect(queryCall?.query_params).toHaveProperty("limit", 5);
    });

    it("limits trace IDs to 5 samples", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            spanName: "slow_operation",
            spanType: "tool",
            avgLatency: 2000.0,
            maxLatency: 3000.0,
            spanCount: 100,
            traceIds: [
              "trace-1",
              "trace-2",
              "trace-3",
              "trace-4",
              "trace-5",
              "trace-6",
              "trace-7",
            ],
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.identifySlowestOperations({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      expect(result[0]?.traceIds).toHaveLength(5);
    });

    it("orders results by average latency descending", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.identifySlowestOperations({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("ORDER BY avgLatency DESC");
    });
  });

  describe("when calculating latency trends", () => {
    it("calculates latency trends over time", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([
          {
            period: "2024-01-01",
            avgLatency: 300.5,
            p50: 250.0,
            p95: 600.0,
            p99: 900.0,
            spanCount: 150,
          },
          {
            period: "2024-01-02",
            avgLatency: 320.8,
            p50: 270.0,
            p95: 650.0,
            p99: 950.0,
            spanCount: 180,
          },
          {
            period: "2024-01-03",
            avgLatency: 290.2,
            p50: 240.0,
            p95: 580.0,
            p99: 880.0,
            spanCount: 160,
          },
        ]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      const result = await service.calculateLatencyTrends({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-04"),
        timePeriod: "day",
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        period: "2024-01-01",
        avgLatency: 300.5,
        p50: 250.0,
        p95: 600.0,
        p99: 900.0,
        spanCount: 150,
      });
    });

    it("uses configurable time windows", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.calculateLatencyTrends({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        timePeriod: "hour",
        timeZone: "America/New_York",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("toStartOfHour");
      expect(queryCall?.query).toContain("America/New_York");
    });

    it("filters by task type when provided", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.calculateLatencyTrends({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
        taskType: "code-generation",
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("langwatch.task_type");
      expect(queryCall?.query_params).toHaveProperty(
        "taskType",
        "code-generation"
      );
    });

    it("orders results by period ascending", async () => {
      const mockResult = {
        json: vi.fn().mockResolvedValue([]),
      };

      mockClickHouseClient.query.mockResolvedValue(mockResult);

      await service.calculateLatencyTrends({
        projectId: "test-project",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"),
      });

      const queryCall = mockClickHouseClient.query.mock.calls[0]?.[0];
      expect(queryCall?.query).toContain("ORDER BY period ASC");
    });
  });
});
