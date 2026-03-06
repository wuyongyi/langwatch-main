import { type Project, type Trigger, TriggerAction } from "@prisma/client";
import { getProtectionsForProject } from "~/server/api/utils";
import { prisma } from "~/server/db";
import { TraceService } from "~/server/traces/trace.service";
import { createLogger } from "~/utils/logger/server";
import { captureException } from "~/utils/posthogErrorCapture";
import { handleAddToAnnotationQueue } from "./actions/addToAnnotationQueue";
import { handleAddToDataset } from "./actions/addToDataset";
import { handleSendEmail } from "./actions/sendEmail";
import { handleSendSlackMessage } from "./actions/sendSlackMessage";
import { applyRiskBasedPriority } from "./risk-integration";
import type { TraceGroups, TriggerData, TriggerResult } from "./types";
import {
  addTriggersSent,
  getLatestUpdatedAt,
  triggerSentForMany,
  updateAlert,
} from "./utils";

const logger = createLogger("langwatch:cron:triggers:trace-based");

export const processTraceBasedTrigger = async (
  trigger: Trigger,
  projects: Project[],
): Promise<TriggerResult> => {
  const {
    id: triggerId,
    projectId,
    filters,
    lastRunAt,
    action,
    name,
  } = trigger;

  let parsedFilters: Record<string, unknown>;
  try {
    parsedFilters = JSON.parse(filters as string);
  } catch (error) {
    captureException(error, {
      extra: {
        triggerId,
        projectId,
        triggerName: name,
        rawFilters: filters as string,
        type: "traceBasedTrigger",
        errorType: "JSONParseError",
      },
    });

    return {
      triggerId,
      status: "error",
      message: "Failed to parse trigger filters JSON",
    };
  }

  const input = {
    projectId,
    filters: parsedFilters,
    updatedAt: lastRunAt,
    startDate: Date.now() - 1000 * 60 * 60 * 24,
    endDate: Date.now(),
  };

  const traceService = TraceService.create(prisma);
  const protections = await getProtectionsForProject(prisma, { projectId });
  const traces = await traceService.getAllTracesForProject(input, protections);

  const tracesToSend = await getTracesToSend(
    traces,
    triggerId,
    input.projectId,
  );

  if (tracesToSend.length > 0) {
    const triggerData: TriggerData[] = tracesToSend.flatMap((group) =>
      group.map((trace) => ({
        input: trace.input?.value ?? "",
        output: trace.output?.value ?? "",
        traceId: trace.trace_id,
        projectId: input.projectId,
        fullTrace: trace,
      })),
    );

    const project = projects.find((project) => project.id === input.projectId);

    if (!project) {
      return {
        triggerId,
        status: "error",
        message: "Project not found",
      };
    }

    // Apply risk-based prioritization
    const { alertType, triggerData: enrichedTriggerData } =
      applyRiskBasedPriority({
        trigger,
        triggerData,
      });

    // Create context with enriched trigger data and determined alert type
    const context = {
      trigger: { ...trigger, alertType },
      projects,
      triggerData: enrichedTriggerData,
      projectSlug: project.slug,
    };

    // Execute the appropriate action
    switch (action) {
      case TriggerAction.SEND_EMAIL:
        await handleSendEmail(context);
        break;
      case TriggerAction.SEND_SLACK_MESSAGE:
        await handleSendSlackMessage(context);
        break;
      case TriggerAction.ADD_TO_ANNOTATION_QUEUE:
        await handleAddToAnnotationQueue(context);
        break;
      case TriggerAction.ADD_TO_DATASET:
        await handleAddToDataset(context);
        break;
    }

    await addTriggersSent(triggerId, enrichedTriggerData);
    const updatedAt = getLatestUpdatedAt(traces) ?? Date.now();

    try {
      await updateAlert(triggerId, updatedAt, project.id);
    } catch (error) {
      logger.error(
        { triggerId, error },
        "failed to update alert for trigger",
      );
    }

    return {
      triggerId,
      updatedAt: updatedAt,
      status: "triggered",
      totalFound: enrichedTriggerData.length,
    };
  }

  return {
    triggerId,
    updatedAt: input.updatedAt,
    status: "not_triggered",
  };
};

const getTracesToSend = async (
  traces: TraceGroups,
  triggerId: string,
  projectId: string,
) => {
  const traceIds = traces.groups.flatMap((group) =>
    group.map((trace) => trace.trace_id),
  );

  const triggersSent = await triggerSentForMany(triggerId, traceIds, projectId);

  const tracesToSend = traces.groups.filter((group) => {
    return group.every((trace) => {
      return !triggersSent.some((sent) => sent.traceId === trace.trace_id);
    });
  });

  return tracesToSend;
};
