import { createTRPCRouter } from "~/server/api/trpc";
import { dataForFilter } from "./analytics/dataForFilter";
import { topUsedDocuments } from "./analytics/documents";
import { feedbacks } from "./analytics/feedbacks";
import { getTimeseries } from "./analytics/timeseries";
import {
  getCurrentRequestsPerMinute,
  getCurrentErrorRate,
  getCurrentAverageLatency,
  getRecentTraces,
  getAllMetrics,
} from "./analytics/realTimeDashboard";

export const analyticsRouter = createTRPCRouter({
  getTimeseries,
  dataForFilter,
  topUsedDocuments,
  feedbacks,
  // Real-time dashboard metrics
  getCurrentRequestsPerMinute,
  getCurrentErrorRate,
  getCurrentAverageLatency,
  getRecentTraces,
  getAllMetrics,
});
