/**
 * MCP tool for creating traces via OTLP protocol
 * 
 * This implementation uses OpenTelemetry SDK to generate OTLP-formatted
 * trace data and sends it to the existing /api/otel/v1/traces endpoint.
 */

import { trace } from "@opentelemetry/api";
import { 
  BasicTracerProvider, 
  SimpleSpanProcessor,
  type Span 
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getConfig } from "../config.js";

interface CreateTraceParams {
  name: string;
  input: string;
  metadata?: {
    user_id?: string;
    thread_id?: string;
    task_type?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Create a new trace using OTLP protocol
 * 
 * This function creates a TracerProvider, starts a span, and exports it
 * to LangWatch via the existing OTLP endpoint.
 * 
 * @param params - Trace creation parameters
 * @returns JSON string with trace_id and success message
 */
export async function handleCreateTrace(params: CreateTraceParams): Promise<string> {
  const config = getConfig();
  
  // Create OTLP exporter pointing to LangWatch
  const exporter = new OTLPTraceExporter({
    url: `${config.endpoint}/api/otel/v1/traces`,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "x-langwatch-sdk-name": "mcp-server",
      "x-langwatch-sdk-version": "0.5.0",
    },
  });

  // Create tracer provider with simple span processor for immediate export
  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  try {
    const tracer = trace.getTracer("langwatch-mcp-server", "0.5.0");

    // Create root span for the agent execution
    const span = tracer.startSpan(params.name, {
      attributes: {
        "langwatch.span.type": "agent",
        "langwatch.span.input": JSON.stringify({ 
          type: "text", 
          value: params.input 
        }),
        // Add metadata as attributes
        ...(params.metadata?.user_id && { 
          "langwatch.user.id": params.metadata.user_id 
        }),
        ...(params.metadata?.thread_id && { 
          "langwatch.thread.id": params.metadata.thread_id 
        }),
        ...(params.metadata?.task_type && { 
          "langwatch.task.type": params.metadata.task_type 
        }),
      },
    }) as Span;

    // Get trace ID before ending span
    const traceId = span.spanContext().traceId;

    // End span immediately (agent will add child spans via SDK)
    span.end();

    // Force export to ensure trace is sent
    await provider.forceFlush();

    return JSON.stringify({
      trace_id: traceId,
      message: "Trace created successfully via OTLP",
      note: "Use SDK instrumentation (@langwatch.span decorator) to add child spans",
    }, null, 2);
  } finally {
    // Clean up provider
    await provider.shutdown();
  }
}
