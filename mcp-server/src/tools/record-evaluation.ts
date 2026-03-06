/**
 * MCP tool for recording evaluation results via OTLP protocol
 * 
 * This implementation creates an evaluation span and sends it to LangWatch
 * via the existing OTLP endpoint.
 */

import { trace, SpanStatusCode } from "@opentelemetry/api";
import { 
  BasicTracerProvider, 
  SimpleSpanProcessor,
  type Span 
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getConfig } from "../config.js";

interface RecordEvaluationParams {
  trace_id: string;
  evaluator_name: string;
  passed: boolean;
  score?: number;
  details?: string;
}

/**
 * Record an evaluation result using OTLP protocol
 * 
 * This function creates an evaluation span and exports it to LangWatch.
 * The evaluation will be associated with the trace via the trace_id.
 * 
 * @param params - Evaluation recording parameters
 * @returns JSON string with success message
 */
export async function handleRecordEvaluation(params: RecordEvaluationParams): Promise<string> {
  const config = getConfig();
  
  // Create OTLP exporter
  const exporter = new OTLPTraceExporter({
    url: `${config.endpoint}/api/otel/v1/traces`,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "x-langwatch-sdk-name": "mcp-server",
      "x-langwatch-sdk-version": "0.5.0",
    },
  });

  // Create tracer provider
  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  try {
    const tracer = trace.getTracer("langwatch-mcp-server", "0.5.0");

    // Create evaluation span
    const span = tracer.startSpan("evaluation", {
      attributes: {
        "langwatch.span.type": "evaluation",
        "langwatch.evaluation.name": params.evaluator_name,
        "langwatch.evaluation.passed": params.passed,
        "langwatch.evaluation.trace_id": params.trace_id,
        ...(params.score !== undefined && { 
          "langwatch.evaluation.score": params.score 
        }),
        ...(params.details && { 
          "langwatch.evaluation.details": params.details 
        }),
      },
    }) as Span;

    // Set span status based on evaluation result
    if (!params.passed) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Evaluation failed: ${params.evaluator_name}`,
      });
    }

    span.end();

    // Force export
    await provider.forceFlush();

    return JSON.stringify({
      message: "Evaluation recorded successfully",
      evaluator: params.evaluator_name,
      passed: params.passed,
      trace_id: params.trace_id,
    }, null, 2);
  } finally {
    // Clean up provider
    await provider.shutdown();
  }
}
