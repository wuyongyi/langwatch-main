/**
 * Agent Metrics Service
 * 
 * Provides aggregation queries for Claude Code agent metrics including:
 * - Cost aggregation by time period, user, task type
 * - Token usage aggregation
 * - Error rate calculation
 * - Error pattern analysis and grouping
 * - Latency percentiles (p50, p95, p99)
 * 
 * Requirements: 9.3, 9.4, 10.2, 10.3, 10.4, 11.2
 */

import type { ClickHouseClient } from "@clickhouse/client";
import { getClickHouseClient } from "~/server/clickhouse/client";
import { createLogger } from "~/utils/logger/server";
import { getLangWatchTracer } from "langwatch";

const logger = createLogger("langwatch:analytics:agent-metrics");
const tracer = getLangWatchTracer("langwatch.analytics.agent-metrics");

/**
 * Time period for aggregation
 */
export type TimePeriod = "hour" | "day" | "week" | "month";

/**
 * Cost aggregation result
 */
export interface CostAggregation {
  period: string;
  totalCost: number;
  promptTokensCost: number;
  completionTokensCost: number;
  traceCount: number;
}

/**
 * Token usage aggregation result
 */
export interface TokenUsageAggregation {
  period: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  traceCount: number;
}

/**
 * Error rate result
 */
export interface ErrorRate {
  period: string;
  totalExecutions: number;
  errorCount: number;
  errorRate: number; // Percentage (0-100)
}

/**
 * Latency percentiles result
 */
export interface LatencyPercentiles {
  period: string;
  p50: number; // Median latency in ms
  p95: number; // 95th percentile in ms
  p99: number; // 99th percentile in ms
  avgLatency: number; // Average latency in ms
  traceCount: number;
}

/**
 * Latency breakdown by skill type result
 */
export interface LatencyBySkillType {
  skillType: string;
  avgLatency: number; // Average latency in ms
  p50: number; // Median latency in ms
  p95: number; // 95th percentile in ms
  p99: number; // 99th percentile in ms
  spanCount: number;
}

/**
 * Slowest operations result
 */
export interface SlowestOperation {
  spanName: string;
  spanType: string;
  avgLatency: number; // Average latency in ms
  maxLatency: number; // Maximum latency in ms
  spanCount: number;
  traceIds: string[]; // Sample trace IDs (up to 5)
}

/**
 * Latency trend over time result
 */
export interface LatencyTrend {
  period: string;
  avgLatency: number; // Average latency in ms
  p50: number; // Median latency in ms
  p95: number; // 95th percentile in ms
  p99: number; // 99th percentile in ms
  spanCount: number;
}

/**
 * Error pattern analysis result
 */
export interface ErrorPattern {
  errorType: string;
  count: number;
  percentage: number; // Percentage of total errors
  sampleMessages: string[]; // Sample error messages (up to 5)
  commonPatterns: string[]; // Common patterns identified in messages
}

/**
 * Error type grouping result
 */
export interface ErrorTypeGroup {
  errorType: string;
  count: number;
  percentage: number; // Percentage of total errors
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Agent metrics query parameters
 */
export interface AgentMetricsQueryParams {
  projectId: string;
  startDate: Date;
  endDate: Date;
  timePeriod?: TimePeriod;
  userId?: string;
  taskType?: string;
  timeZone?: string;
}

/**
 * Agent Metrics Service
 */
export class AgentMetricsService {
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
   * Aggregate cost by time period, user, and task type
   * 
   * Requirements: 9.3
   */
  async aggregateCost(
    params: AgentMetricsQueryParams
  ): Promise<CostAggregation[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.aggregateCost",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const timeGrouping = this.getTimeGrouping(
          params.timePeriod ?? "day",
          params.timeZone ?? "UTC"
        );

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            ${timeGrouping} AS period,
            sum(ts.TotalCost) AS totalCost,
            sum(ts.TotalPromptTokenCount * 0.000001) AS promptTokensCost,
            sum(ts.TotalCompletionTokenCount * 0.000001) AS completionTokensCost,
            count() AS traceCount
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startDate:DateTime64(3)}
            AND ts.OccurredAt < {endDate:DateTime64(3)}
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY period
          ORDER BY period ASC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing cost aggregation query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            period: string;
            totalCost: number;
            promptTokensCost: number;
            completionTokensCost: number;
            traceCount: string | number;
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            period: row.period,
            totalCost: Number(row.totalCost) || 0,
            promptTokensCost: Number(row.promptTokensCost) || 0,
            completionTokensCost: Number(row.completionTokensCost) || 0,
            traceCount:
              typeof row.traceCount === "string"
                ? parseInt(row.traceCount, 10)
                : row.traceCount,
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute cost aggregation query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Aggregate token usage by time period
   * 
   * Requirements: 9.4
   */
  async aggregateTokenUsage(
    params: AgentMetricsQueryParams
  ): Promise<TokenUsageAggregation[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.aggregateTokenUsage",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const timeGrouping = this.getTimeGrouping(
          params.timePeriod ?? "day",
          params.timeZone ?? "UTC"
        );

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            ${timeGrouping} AS period,
            sum(coalesce(ts.TotalPromptTokenCount, 0) + coalesce(ts.TotalCompletionTokenCount, 0)) AS totalTokens,
            sum(coalesce(ts.TotalPromptTokenCount, 0)) AS promptTokens,
            sum(coalesce(ts.TotalCompletionTokenCount, 0)) AS completionTokens,
            count() AS traceCount
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startDate:DateTime64(3)}
            AND ts.OccurredAt < {endDate:DateTime64(3)}
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY period
          ORDER BY period ASC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing token usage aggregation query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            period: string;
            totalTokens: string | number;
            promptTokens: string | number;
            completionTokens: string | number;
            traceCount: string | number;
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            period: row.period,
            totalTokens:
              typeof row.totalTokens === "string"
                ? parseInt(row.totalTokens, 10)
                : row.totalTokens,
            promptTokens:
              typeof row.promptTokens === "string"
                ? parseInt(row.promptTokens, 10)
                : row.promptTokens,
            completionTokens:
              typeof row.completionTokens === "string"
                ? parseInt(row.completionTokens, 10)
                : row.completionTokens,
            traceCount:
              typeof row.traceCount === "string"
                ? parseInt(row.traceCount, 10)
                : row.traceCount,
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute token usage aggregation query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Calculate error rate as percentage of total executions
   * 
   * Requirements: 10.2
   */
  async calculateErrorRate(
    params: AgentMetricsQueryParams
  ): Promise<ErrorRate[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.calculateErrorRate",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const timeGrouping = this.getTimeGrouping(
          params.timePeriod ?? "day",
          params.timeZone ?? "UTC"
        );

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            ${timeGrouping} AS period,
            count() AS totalExecutions,
            countIf(ts.ErrorState = true) AS errorCount,
            (errorCount * 100.0 / nullIf(totalExecutions, 0)) AS errorRate
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startDate:DateTime64(3)}
            AND ts.OccurredAt < {endDate:DateTime64(3)}
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY period
          ORDER BY period ASC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing error rate calculation query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            period: string;
            totalExecutions: string | number;
            errorCount: string | number;
            errorRate: number;
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            period: row.period,
            totalExecutions:
              typeof row.totalExecutions === "string"
                ? parseInt(row.totalExecutions, 10)
                : row.totalExecutions,
            errorCount:
              typeof row.errorCount === "string"
                ? parseInt(row.errorCount, 10)
                : row.errorCount,
            errorRate: Number(row.errorRate) || 0,
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute error rate calculation query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Calculate latency percentiles (p50, p95, p99)
   * 
   * Requirements: 11.2
   */
  async calculateLatencyPercentiles(
    params: AgentMetricsQueryParams
  ): Promise<LatencyPercentiles[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.calculateLatencyPercentiles",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const timeGrouping = this.getTimeGrouping(
          params.timePeriod ?? "day",
          params.timeZone ?? "UTC"
        );

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            ${timeGrouping} AS period,
            quantileExact(0.5)(ts.TotalDurationMs) AS p50,
            quantileExact(0.95)(ts.TotalDurationMs) AS p95,
            quantileExact(0.99)(ts.TotalDurationMs) AS p99,
            avg(ts.TotalDurationMs) AS avgLatency,
            count() AS traceCount
          FROM trace_summaries AS ts
          WHERE ts.ProjectId = {projectId:String}
            AND ts.OccurredAt >= {startDate:DateTime64(3)}
            AND ts.OccurredAt < {endDate:DateTime64(3)}
            AND ts.TotalDurationMs IS NOT NULL
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY period
          ORDER BY period ASC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing latency percentiles query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            period: string;
            p50: number;
            p95: number;
            p99: number;
            avgLatency: number;
            traceCount: string | number;
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            period: row.period,
            p50: Number(row.p50) || 0,
            p95: Number(row.p95) || 0,
            p99: Number(row.p99) || 0,
            avgLatency: Number(row.avgLatency) || 0,
            traceCount:
              typeof row.traceCount === "string"
                ? parseInt(row.traceCount, 10)
                : row.traceCount,
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute latency percentiles query"
          );
          throw error;
        }
      }
    );
  }
  /**
   * Calculate latency breakdown by skill type
   *
   * Requirements: 11.3
   */
  async calculateLatencyBySkillType(
    params: AgentMetricsQueryParams
  ): Promise<LatencyBySkillType[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.calculateLatencyBySkillType",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            coalesce(ss.SpanAttributes['langwatch.span.type'], 'unknown') AS skillType,
            avg(ss.DurationMs) AS avgLatency,
            quantileExact(0.5)(ss.DurationMs) AS p50,
            quantileExact(0.95)(ss.DurationMs) AS p95,
            quantileExact(0.99)(ss.DurationMs) AS p99,
            count() AS spanCount
          FROM stored_spans AS ss
          INNER JOIN trace_summaries AS ts ON ss.TraceId = ts.TraceId AND ss.TenantId = ts.TenantId
          WHERE ss.TenantId = {projectId:String}
            AND ss.StartTime >= {startDate:DateTime64(3)}
            AND ss.StartTime < {endDate:DateTime64(3)}
            AND ss.DurationMs IS NOT NULL
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY skillType
          ORDER BY avgLatency DESC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing latency by skill type query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            skillType: string;
            avgLatency: number;
            p50: number;
            p95: number;
            p99: number;
            spanCount: string | number;
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            skillType: row.skillType,
            avgLatency: Number(row.avgLatency) || 0,
            p50: Number(row.p50) || 0,
            p95: Number(row.p95) || 0,
            p99: Number(row.p99) || 0,
            spanCount:
              typeof row.spanCount === "string"
                ? parseInt(row.spanCount, 10)
                : row.spanCount,
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute latency by skill type query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Identify slowest operations
   *
   * Requirements: 11.4
   */
  async identifySlowestOperations(
    params: AgentMetricsQueryParams & { limit?: number }
  ): Promise<SlowestOperation[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.identifySlowestOperations",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const limit = params.limit ?? 10;

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            ss.SpanName AS spanName,
            coalesce(ss.SpanAttributes['langwatch.span.type'], 'unknown') AS spanType,
            avg(ss.DurationMs) AS avgLatency,
            max(ss.DurationMs) AS maxLatency,
            count() AS spanCount,
            groupArray(5)(ss.TraceId) AS traceIds
          FROM stored_spans AS ss
          INNER JOIN trace_summaries AS ts ON ss.TraceId = ts.TraceId AND ss.TenantId = ts.TenantId
          WHERE ss.TenantId = {projectId:String}
            AND ss.StartTime >= {startDate:DateTime64(3)}
            AND ss.StartTime < {endDate:DateTime64(3)}
            AND ss.DurationMs IS NOT NULL
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY spanName, spanType
          ORDER BY avgLatency DESC
          LIMIT {limit:UInt32}
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
          limit,
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing slowest operations query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            spanName: string;
            spanType: string;
            avgLatency: number;
            maxLatency: number;
            spanCount: string | number;
            traceIds: string[];
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            spanName: row.spanName,
            spanType: row.spanType,
            avgLatency: Number(row.avgLatency) || 0,
            maxLatency: Number(row.maxLatency) || 0,
            spanCount:
              typeof row.spanCount === "string"
                ? parseInt(row.spanCount, 10)
                : row.spanCount,
            traceIds: row.traceIds.slice(0, 5),
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute slowest operations query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Display latency trends over time with configurable time windows
   *
   * Requirements: 11.5
   */
  async calculateLatencyTrends(
    params: AgentMetricsQueryParams
  ): Promise<LatencyTrend[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.calculateLatencyTrends",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const timeGrouping = this.getTimeGrouping(
          params.timePeriod ?? "day",
          params.timeZone ?? "UTC"
        );

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            ${timeGrouping} AS period,
            avg(ss.DurationMs) AS avgLatency,
            quantileExact(0.5)(ss.DurationMs) AS p50,
            quantileExact(0.95)(ss.DurationMs) AS p95,
            quantileExact(0.99)(ss.DurationMs) AS p99,
            count() AS spanCount
          FROM stored_spans AS ss
          INNER JOIN trace_summaries AS ts ON ss.TraceId = ts.TraceId AND ss.TenantId = ts.TenantId
          WHERE ss.TenantId = {projectId:String}
            AND ss.StartTime >= {startDate:DateTime64(3)}
            AND ss.StartTime < {endDate:DateTime64(3)}
            AND ss.DurationMs IS NOT NULL
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY period
          ORDER BY period ASC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing latency trends query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            period: string;
            avgLatency: number;
            p50: number;
            p95: number;
            p99: number;
            spanCount: string | number;
          }>;

          span.setAttribute("result.count", rows.length);

          return rows.map((row) => ({
            period: row.period,
            avgLatency: Number(row.avgLatency) || 0,
            p50: Number(row.p50) || 0,
            p95: Number(row.p95) || 0,
            p99: Number(row.p99) || 0,
            spanCount:
              typeof row.spanCount === "string"
                ? parseInt(row.spanCount, 10)
                : row.spanCount,
          }));
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute latency trends query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Get time grouping expression for ClickHouse based on time period
   */
  private getTimeGrouping(period: TimePeriod, timeZone: string): string {
    switch (period) {
      case "hour":
        return `toStartOfHour(ts.OccurredAt, '${timeZone}')`;
      case "day":
        return `toStartOfDay(ts.OccurredAt, '${timeZone}')`;
      case "week":
        return `toStartOfWeek(ts.OccurredAt, '${timeZone}')`;
      case "month":
        return `toStartOfMonth(ts.OccurredAt, '${timeZone}')`;
      default:
        return `toStartOfDay(ts.OccurredAt, '${timeZone}')`;
    }
  }

  /**
   * Group errors by error type and count frequency
   * 
   * Requirements: 10.3
   */
  async groupErrorsByType(
    params: AgentMetricsQueryParams
  ): Promise<ErrorTypeGroup[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.groupErrorsByType",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        const sql = `
          SELECT
            coalesce(ss.SpanAttributes['error.type'], 'unknown') AS errorType,
            count() AS count,
            min(ss.StartTime) AS firstSeen,
            max(ss.StartTime) AS lastSeen
          FROM stored_spans AS ss
          INNER JOIN trace_summaries AS ts ON ss.TraceId = ts.TraceId AND ss.TenantId = ts.TenantId
          WHERE ss.TenantId = {projectId:String}
            AND ss.StatusCode = 2
            AND ss.StartTime >= {startDate:DateTime64(3)}
            AND ss.StartTime < {endDate:DateTime64(3)}
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY errorType
          ORDER BY count DESC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing error type grouping query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            errorType: string;
            count: string | number;
            firstSeen: string;
            lastSeen: string;
          }>;

          const totalErrors = rows.reduce(
            (sum, row) =>
              sum +
              (typeof row.count === "string"
                ? parseInt(row.count, 10)
                : row.count),
            0
          );

          span.setAttribute("result.count", rows.length);
          span.setAttribute("result.totalErrors", totalErrors);

          return rows.map((row) => {
            const count =
              typeof row.count === "string"
                ? parseInt(row.count, 10)
                : row.count;
            return {
              errorType: row.errorType,
              count,
              percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
              firstSeen: new Date(row.firstSeen),
              lastSeen: new Date(row.lastSeen),
            };
          });
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute error type grouping query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Analyze error patterns from messages and stack traces
   * 
   * Requirements: 10.4
   */
  async analyzeErrorPatterns(
    params: AgentMetricsQueryParams
  ): Promise<ErrorPattern[]> {
    return tracer.withActiveSpan(
      "AgentMetricsService.analyzeErrorPatterns",
      { attributes: { "tenant.id": params.projectId } },
      async (span) => {
        if (!this.clickHouseClient) {
          throw new Error("ClickHouse client not available");
        }

        const userFilter = params.userId
          ? `AND ts.Attributes['langwatch.user_id'] = {userId:String}`
          : "";
        const taskTypeFilter = params.taskType
          ? `AND ts.Attributes['langwatch.task_type'] = {taskType:String}`
          : "";

        // First, get error messages grouped by type
        const sql = `
          SELECT
            coalesce(ss.SpanAttributes['error.type'], 'unknown') AS errorType,
            count() AS count,
            groupArray(5)(ss.StatusMessage) AS sampleMessages
          FROM stored_spans AS ss
          INNER JOIN trace_summaries AS ts ON ss.TraceId = ts.TraceId AND ss.TenantId = ts.TenantId
          WHERE ss.TenantId = {projectId:String}
            AND ss.StatusCode = 2
            AND ss.StartTime >= {startDate:DateTime64(3)}
            AND ss.StartTime < {endDate:DateTime64(3)}
            AND ss.StatusMessage IS NOT NULL
            AND ss.StatusMessage != ''
            ${userFilter}
            ${taskTypeFilter}
          GROUP BY errorType
          ORDER BY count DESC
        `;

        const queryParams: Record<string, unknown> = {
          projectId: params.projectId,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
        };

        if (params.userId) {
          queryParams.userId = params.userId;
        }
        if (params.taskType) {
          queryParams.taskType = params.taskType;
        }

        logger.debug({ sql, queryParams }, "Executing error pattern analysis query");

        try {
          const result = await this.clickHouseClient.query({
            query: sql,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const rows = (await result.json()) as Array<{
            errorType: string;
            count: string | number;
            sampleMessages: string[];
          }>;

          const totalErrors = rows.reduce(
            (sum, row) =>
              sum +
              (typeof row.count === "string"
                ? parseInt(row.count, 10)
                : row.count),
            0
          );

          span.setAttribute("result.count", rows.length);
          span.setAttribute("result.totalErrors", totalErrors);

          return rows.map((row) => {
            const count =
              typeof row.count === "string"
                ? parseInt(row.count, 10)
                : row.count;
            const sampleMessages = row.sampleMessages.filter(
              (msg) => msg && msg.trim() !== ""
            );
            const commonPatterns = this.extractCommonPatterns(sampleMessages);

            return {
              errorType: row.errorType,
              count,
              percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
              sampleMessages: sampleMessages.slice(0, 5),
              commonPatterns,
            };
          });
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error, sql },
            "Failed to execute error pattern analysis query"
          );
          throw error;
        }
      }
    );
  }

  /**
   * Extract common patterns from error messages
   * 
   * Identifies recurring patterns like:
   * - Rate limit errors
   * - Timeout errors
   * - Authentication errors
   * - Connection errors
   * - Validation errors
   */
  private extractCommonPatterns(messages: string[]): string[] {
    if (messages.length === 0) {
      return [];
    }

    const patterns: Map<string, number> = new Map();

    // Define common error patterns to look for
    const patternMatchers = [
      { pattern: /rate\s*limit/i, name: "Rate limit exceeded" },
      { pattern: /timeout|timed\s*out/i, name: "Timeout" },
      { pattern: /auth|unauthorized|forbidden/i, name: "Authentication/Authorization" },
      { pattern: /connection|connect|network/i, name: "Connection error" },
      { pattern: /validation|invalid|malformed/i, name: "Validation error" },
      { pattern: /not\s*found|404/i, name: "Resource not found" },
      { pattern: /server\s*error|500|internal/i, name: "Server error" },
      { pattern: /quota|exceeded|limit/i, name: "Quota exceeded" },
      { pattern: /permission|denied|access/i, name: "Permission denied" },
      { pattern: /null|undefined|missing/i, name: "Null/undefined value" },
    ];

    // Count pattern occurrences
    for (const message of messages) {
      for (const { pattern, name } of patternMatchers) {
        if (pattern.test(message)) {
          patterns.set(name, (patterns.get(name) ?? 0) + 1);
        }
      }
    }

    // Return patterns that appear in at least 20% of messages, sorted by frequency
    const threshold = Math.max(1, Math.ceil(messages.length * 0.2));
    return Array.from(patterns.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }
}

/**
 * Singleton instance
 */
let agentMetricsService: AgentMetricsService | null = null;

/**
 * Get the agent metrics service instance
 */
export function getAgentMetricsService(): AgentMetricsService {
  if (!agentMetricsService) {
    agentMetricsService = new AgentMetricsService();
  }
  return agentMetricsService;
}
