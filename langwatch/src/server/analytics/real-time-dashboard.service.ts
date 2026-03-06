/**
 * Real-Time Dashboard Metrics Service
 * 
 * Provides real-time metrics for dashboard display including:
 * - Current requests per minute
 * - Current error rate
 * - Current average latency
 * - Recent traces with status indicators
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

import type { ClickHouseClient } from "@clickhouse/client";
import { getClickHouseClient } from "~/server/clickhouse/client";
import { createLogger } from "~/utils/logger/server";
import { getLangWatchTracer } from "langwatch";

const logger = createLogger("langwatch:analytics:real-time-dashboard");
const tracer = getLangWatchTracer("langwatch.analytics.real-time-dashboard");

/**
 * Current requests per minute result
 */
export interface CurrentRequestsPerMinute {
  requestsPerMinute: number;
  timestamp: Date;
}

/**
 * Current error rate result
 */
export interface CurrentErrorRate {
  errorRate: number; // Percentage (0-100)
  totalRequests: number;
  errorCount: number;
  timestamp: Date;
}

/**
 * Current average latency result
 */
export interface CurrentAverageLatency {
  averageLatency: number; // Milliseconds
  requestCount: number;
  timestamp: Date;
}

/**
 * Recent trace result
 */
export interface RecentTrace {
  traceId: string;
  occurredAt: Date;
  status: "success" | "error";
  durationMs: number;
  cost: number;
}

/**
 * Recent traces result
 */
export interface RecentTraces {
  traces: RecentTrace[];
  timestamp: Date;
}

/**
 * Real-time dashboard query parameters
 */
export interface RealTimeDashboardQueryParams {
  projectId: string;
  currentTime?: Date;
  timeWindowMinutes?: number;
  limit?: number;
}

/**
 * Real-Time Dashboard Metrics Service
 */
export class RealTimeDashboardService {
  private readonly clickHouseClient: ClickHouseClient | null;

  constructor() {
    this.clickHouseClient = getClickHouseClient();
  }

  /**
   * Check if ClickHouse client is available
   */
  isAvailable(): boolean {
    return this.clickHouseClient !== null;
  }

  /**
   * Calculate current requests per minute
   * 
   * Requirements: 18.1
   */
  async getCurrentRequestsPerMinute(
    params: RealTimeDashboardQueryParams
  ): Promise<CurrentRequestsPerMinute> {
    return tracer.withActiveSpan(
      "RealTimeDashboardService.getCurrentRequestsPerMinute",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const currentTime = params.currentTime ?? new Date();
        const startTime = new Date(currentTime.getTime() - 60 * 1000); // 1 minute ago

        const sql = `
          SELECT
            count() AS requestCount
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startTime:DateTime64(3)}
            AND ts.OccurredAt < {endTime:DateTime64(3)}
        `;

        const queryParams = {
          projectId: params.projectId,
          startTime: startTime.toISOString(),
          endTime: currentTime.toISOString(),
        };

        logger.debug({ sql, queryParams }, "Executing requests per minute query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            requestCount: string | number;
          }>;

          const requestCount =
            rows.length > 0
              ? typeof rows[0].requestCount === "string"
                ? parseInt(rows[0].requestCount, 10)
                : rows[0].requestCount
              : 0;

          span.setAttribute("result.requestsPerMinute", requestCount);

          return {
            requestsPerMinute: requestCount,
            timestamp: currentTime,
          };
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute requests per minute query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Calculate current error rate
   * 
   * Requirements: 18.2
   */
  async getCurrentErrorRate(
    params: RealTimeDashboardQueryParams
  ): Promise<CurrentErrorRate> {
    return tracer.withActiveSpan(
      "RealTimeDashboardService.getCurrentErrorRate",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const currentTime = params.currentTime ?? new Date();
        const timeWindowMinutes = params.timeWindowMinutes ?? 5;
        const startTime = new Date(
          currentTime.getTime() - timeWindowMinutes * 60 * 1000
        );

        const sql = `
          SELECT
            count() AS totalRequests,
            countIf(ts.ErrorState = true) AS errorCount,
            (errorCount * 100.0 / nullIf(totalRequests, 0)) AS errorRate
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startTime:DateTime64(3)}
            AND ts.OccurredAt < {endTime:DateTime64(3)}
        `;

        const queryParams = {
          projectId: params.projectId,
          startTime: startTime.toISOString(),
          endTime: currentTime.toISOString(),
        };

        logger.debug({ sql, queryParams }, "Executing current error rate query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            totalRequests: string | number;
            errorCount: string | number;
            errorRate: number;
          }>;

          if (rows.length === 0) {
            return {
              errorRate: 0,
              totalRequests: 0,
              errorCount: 0,
              timestamp: currentTime,
            };
          }

          const row = rows[0];
          const totalRequests =
            typeof row.totalRequests === "string"
              ? parseInt(row.totalRequests, 10)
              : row.totalRequests;
          const errorCount =
            typeof row.errorCount === "string"
              ? parseInt(row.errorCount, 10)
              : row.errorCount;

          span.setAttribute("result.errorRate", row.errorRate);
          span.setAttribute("result.totalRequests", totalRequests);

          return {
            errorRate: Number(row.errorRate) || 0,
            totalRequests,
            errorCount,
            timestamp: currentTime,
          };
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute current error rate query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Calculate current average latency
   * 
   * Requirements: 18.3
   */
  async getCurrentAverageLatency(
    params: RealTimeDashboardQueryParams
  ): Promise<CurrentAverageLatency> {
    return tracer.withActiveSpan(
      "RealTimeDashboardService.getCurrentAverageLatency",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const currentTime = params.currentTime ?? new Date();
        const timeWindowMinutes = params.timeWindowMinutes ?? 5;
        const startTime = new Date(
          currentTime.getTime() - timeWindowMinutes * 60 * 1000
        );

        const sql = `
          SELECT
            avg(ts.TotalDurationMs) AS avgLatency,
            count() AS requestCount
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startTime:DateTime64(3)}
            AND ts.OccurredAt < {endTime:DateTime64(3)}
            AND ts.TotalDurationMs IS NOT NULL
        `;

        const queryParams = {
          projectId: params.projectId,
          startTime: startTime.toISOString(),
          endTime: currentTime.toISOString(),
        };

        logger.debug({ sql, queryParams }, "Executing current average latency query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            avgLatency: number;
            requestCount: string | number;
          }>;

          if (rows.length === 0) {
            return {
              averageLatency: 0,
              requestCount: 0,
              timestamp: currentTime,
            };
          }

          const row = rows[0];
          const requestCount =
            typeof row.requestCount === "string"
              ? parseInt(row.requestCount, 10)
              : row.requestCount;

          span.setAttribute("result.averageLatency", row.avgLatency);
          span.setAttribute("result.requestCount", requestCount);

          return {
            averageLatency: Number(row.avgLatency) || 0,
            requestCount,
            timestamp: currentTime,
          };
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute current average latency query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Get recent traces with status indicators
   * 
   * Requirements: 18.4
   */
  async getRecentTraces(
    params: RealTimeDashboardQueryParams
  ): Promise<RecentTraces> {
    return tracer.withActiveSpan(
      "RealTimeDashboardService.getRecentTraces",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const currentTime = params.currentTime ?? new Date();
        const limit = params.limit ?? 10;

        const sql = `
          SELECT
            ts.TraceId AS traceId,
            ts.OccurredAt AS occurredAt,
            ts.ErrorState AS errorState,
            ts.TotalDurationMs AS totalDurationMs,
            ts.TotalCost AS totalCost
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt < {endTime:DateTime64(3)}
          ORDER BY ts.OccurredAt DESC
          LIMIT {limit:UInt32}
        `;

        const queryParams = {
          projectId: params.projectId,
          endTime: currentTime.toISOString(),
          limit,
        };

        logger.debug({ sql, queryParams }, "Executing recent traces query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            traceId: string;
            occurredAt: string;
            errorState: boolean;
            totalDurationMs: number;
            totalCost: number;
          }>;

          span.setAttribute("result.count", rows.length);

          const traces: RecentTrace[] = rows.map((row) => ({
            traceId: row.traceId,
            occurredAt: new Date(row.occurredAt),
            status: row.errorState ? "error" : "success",
            durationMs: Number(row.totalDurationMs) || 0,
            cost: Number(row.totalCost) || 0,
          }));

          return {
            traces,
            timestamp: currentTime,
          };
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute recent traces query"
          );
          throw error;
        }
      }
    );
  }
}

/**
 * Singleton instance
 */
let realTimeDashboardService: RealTimeDashboardService | null = null;

/**
 * Get the real-time dashboard service instance
 */
export function getRealTimeDashboardService(): RealTimeDashboardService {
  if (!realTimeDashboardService) {
    realTimeDashboardService = new RealTimeDashboardService();
  }
  return realTimeDashboardService;
}
