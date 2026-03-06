export {
  FilterableBatchSpanProcessor,
  type SpanProcessingExcludeRule,
} from "./processors";
export {
  LangWatchExporter,
  type LangWatchExporterOptions,
  LangWatchTraceExporter,
  type LangWatchTraceExporterOptions,
  LangWatchLogsExporter,
  type LangWatchLogsExporterOptions,
} from "./exporters";

export {
  type DataCaptureConfig,
  type DataCaptureMode,
  type DataCaptureContext,
  type DataCapturePredicate,
  type DataCaptureOptions,
  DataCapturePresets,
} from "./features/data-capture";

export {
  createLangWatchSpan,
  type LangWatchSpan,
  type SpanType,
  spanTypes,
  type LangWatchSpanMetrics,
  type LangWatchSpanRAGContext,
  type LangWatchSpanOptions,
  type InputOutputType,
  type JsonSerializable,
  type SimpleChatMessage,
  type INPUT_OUTPUT_TYPES,
} from "./span";

export {
  getLangWatchLogger,
  getLangWatchLoggerFromProvider,
  type LangWatchLogger,
} from "./logger";
export {
  getLangWatchTracer,
  getLangWatchTracerFromProvider,
  type LangWatchTracer,
} from "./tracer";

export {
  getDataCaptureMode,
  shouldCaptureInput,
  shouldCaptureOutput,
} from "./config.js";

export {
  type SemConvAttributes,
  type SemConvLogRecordAttributes,
  type SemConvAttributeKey,
} from "./semconv";

export * as attributes from "./semconv/attributes";

// Agent instrumentation exports
export {
  setupAgentObservability,
  ConfigurationError,
} from "./setup/agent-setup";

export {
  type AgentInstrumentationConfig,
  type RedactionRule,
  type RiskLevel,
  type AgentSpanType,
} from "./agent-instrumentation-types";

export {
  trace,
  type TraceOptions,
  span,
  type SpanOptions,
} from "./decorators";

// Risk assessment and classification
export {
  RiskClassifier,
  validateRiskLevel,
  tagSpanWithRisk,
  type RiskTagOptions,
} from "./risk";

// Alert rule configuration
export {
  type AlertRule,
  type CreateAlertRuleInput,
  type UpdateAlertRuleInput,
  type AlertConditionType,
  type ErrorRateAlertCondition,
  type LatencyAlertCondition,
  type CostAlertCondition,
  type AlertMetricType,
  type AlertOperator,
  type AlertSeverity,
  type AlertTimePeriod,
  type NotificationChannel,
  type NotificationConfig,
  type EmailNotificationConfig,
  type WebhookNotificationConfig,
  createAlertRule,
  getAlertRule,
  getAllAlertRules,
  updateAlertRule,
  deleteAlertRule,
  validateAlertRule,
} from "./alerts";
