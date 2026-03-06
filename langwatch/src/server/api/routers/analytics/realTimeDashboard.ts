/**
 * Real-Time Dashboard Analytics Router
 * 
 * Provides tRPC procedures for real-time dashboard metrics:
 * - Current requests per minute
 * - Current error rate
 * - Current average latency
 * - Recent traces with status indicators
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

import { z } from "zod";
import { getRealTimeDashboardService } from "../../../analytics/real-time-dashboard.service";
import { checkProjectPermission } from "../../rbac";
import { protectedProcedure } from "../../trpc";

const realTimeDashboardQuerySchema = z.object({
  projectId: z.string(),
  currentTime: z.date().optional(),
  timeWindowMinutes: z.number().min(1).max(60).optional(),
  limit: z.number().min(1).max(100).optional(),
});

/**
 * Get current requests per minute
 * 
 * Requirements: 18.1
 */
export const getCurrentRequestsPerMinute = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      currentTime: z.date().optional(),
    })
  )
  .use(checkProjectPermission("analytics:view"))
  .query(async ({ input }) => {
    const service = getRealTimeDashboardService();
    return service.getCurrentRequestsPerMinute(input);
  });

/**
 * Get current error rate
 * 
 * Requirements: 18.2
 */
export const getCurrentErrorRate = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      currentTime: z.date().optional(),
      timeWindowMinutes: z.number().min(1).max(60).optional(),
    })
  )
  .use(checkProjectPermission("analytics:view"))
  .query(async ({ input }) => {
    const service = getRealTimeDashboardService();
    return service.getCurrentErrorRate(input);
  });

/**
 * Get current average latency
 * 
 * Requirements: 18.3
 */
export const getCurrentAverageLatency = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      currentTime: z.date().optional(),
      timeWindowMinutes: z.number().min(1).max(60).optional(),
    })
  )
  .use(checkProjectPermission("analytics:view"))
  .query(async ({ input }) => {
    const service = getRealTimeDashboardService();
    return service.getCurrentAverageLatency(input);
  });

/**
 * Get recent traces with status indicators
 * 
 * Requirements: 18.4
 */
export const getRecentTraces = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      currentTime: z.date().optional(),
      limit: z.number().min(1).max(100).optional(),
    })
  )
  .use(checkProjectPermission("analytics:view"))
  .query(async ({ input }) => {
    const service = getRealTimeDashboardService();
    return service.getRecentTraces(input);
  });

/**
 * Get all real-time dashboard metrics in a single call
 * 
 * This is a convenience endpoint that fetches all metrics at once
 * to reduce the number of API calls needed for dashboard refresh.
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */
export const getAllMetrics = protectedProcedure
  .input(realTimeDashboardQuerySchema)
  .use(checkProjectPermission("analytics:view"))
  .query(async ({ input }) => {
    const service = getRealTimeDashboardService();

    // Fetch all metrics in parallel
    const [requestsPerMinute, errorRate, averageLatency, recentTraces] =
      await Promise.all([
        service.getCurrentRequestsPerMinute(input),
        service.getCurrentErrorRate(input),
        service.getCurrentAverageLatency(input),
        service.getRecentTraces(input),
      ]);

    return {
      requestsPerMinute,
      errorRate,
      averageLatency,
      recentTraces,
    };
  });
