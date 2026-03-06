# OTLP Wrapper Approach for MCP Tools

## Overview

Instead of creating new REST API endpoints, we can implement the blocked MCP tools (`create_trace`, `add_span`, `record_evaluation`) by using the OpenTelemetry SDK to generate OTLP-formatted data and sending it to the existing `/api/otel/v1/traces` endpoint.

## Benefits

✅ **No backend changes needed** - Reuses existing OTLP ingestion pipeline  
✅ **Faster implementation** - 2-4 hours vs 8-16 hours for REST API  
✅ **Lower risk** - No new code paths in backend  
✅ **Data consistency** - Uses same format as SDK instrumentation  
✅ **Battle-tested** - OTLP pipeline already handles production traffic  

## Architecture

```
┌─────────────────┐
│  Claude Agent   │
│   (MCP Client)  │
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────────────────────────┐
│  LangWatch MCP Server               │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ create_trace MCP Tool        │  │
│  │  - Uses OpenTelemetry SDK    │  │
│  │  - Generates OTLP payload    │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │ OTLPTraceExporter            │  │
│  │  - Formats as OTLP/HTTP      │  │
│  └──────────┬───────────────────┘  │
└─────────────┼───────────────────────┘
              │ HTTPS POST
              ▼
┌─────────────────────────────────────┐
│  LangWatch Backend                  │
│                                     │
│  /api/otel/v1/traces (existing)    │
│  ┌──────────────────────────────┐  │
│  │ OTLP Ingestion Handler       │  │
│  │  - Validates OTLP format     │  │
│  │  - Queues to Bull            │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │ Bull Queue Workers           │  │
│  │  - Process traces            │  │
│  │  - Store in ES/ClickHouse    │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Implementation

### 1. Add Dependencies to MCP Server

```json
// mcp-server/package.json
{
  "dependencies": {
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-trace-base": "^1.28.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.56.0"
  }
}
```

### 2. Implement create_trace Tool

```typescript
// mcp-server/src/tools/create-trace.ts
import { trace } from "@opentelemetry/api";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getConfig } from "../config.js";

export async function handleCreateTrace(params: {
  name: string;
  input: string;
  metadata?: {
    user_id?: string;
    thread_id?: string;
    task_type?: string;
  };
}): Promise<string> {
  const config = getConfig();
  
  // Create OTLP exporter
  const exporter = new OTLPTraceExporter({
    url: `${config.endpoint}/api/otel/v1/traces`,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
    },
  });

  // Create tracer provider
  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  const tracer = trace.getTracer("langwatch-mcp-server");

  // Create root span
  const span = tracer.startSpan(params.name, {
    attributes: {
      "langwatch.span.type": "agent",
      "langwatch.span.input": JSON.stringify({ 
        type: "text", 
        value: params.input 
      }),
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
  });

  // Get trace ID
  const traceId = span.spanContext().traceId;

  // End span
  span.end();

  // Force export
  await provider.forceFlush();
  await provider.shutdown();

  return JSON.stringify({
    trace_id: traceId,
    message: "Trace created successfully via OTLP",
  }, null, 2);
}
```

### 3. Register Tool in MCP Server

```typescript
// mcp-server/src/index.ts
server.tool(
  "create_trace",
  "Create a new trace for agent execution. Returns trace_id for adding spans.",
  {
    name: z.string().describe("Trace name"),
    input: z.string().describe("Agent input"),
    metadata: z.object({
      user_id: z.string().optional(),
      thread_id: z.string().optional(),
      task_type: z.string().optional(),
    }).optional(),
  },
  async (params) => {
    const { requireApiKey } = await import("./config.js");
    requireApiKey();
    const { handleCreateTrace } = await import("./tools/create-trace.js");
    return {
      content: [{ type: "text", text: await handleCreateTrace(params) }],
    };
  }
);
```

### 4. Implement record_evaluation Tool

For evaluations, we can either:
- **Option A**: Use OTLP to send evaluation as a span attribute
- **Option B**: Use existing LangWatch API if available

```typescript
// mcp-server/src/tools/record-evaluation.ts
export async function handleRecordEvaluation(params: {
  trace_id: string;
  evaluator_name: string;
  passed: boolean;
  score?: number;
  details?: string;
}): Promise<string> {
  const config = getConfig();
  
  // Option A: Send as OTLP span with evaluation attributes
  const exporter = new OTLPTraceExporter({
    url: `${config.endpoint}/api/otel/v1/traces`,
    headers: { authorization: `Bearer ${config.apiKey}` },
  });

  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  const tracer = trace.getTracer("langwatch-mcp-server");

  // Create evaluation span
  const span = tracer.startSpan("evaluation", {
    attributes: {
      "langwatch.span.type": "evaluation",
      "langwatch.evaluation.name": params.evaluator_name,
      "langwatch.evaluation.passed": params.passed,
      ...(params.score !== undefined && { 
        "langwatch.evaluation.score": params.score 
      }),
      ...(params.details && { 
        "langwatch.evaluation.details": params.details 
      }),
    },
  });

  span.end();
  await provider.forceFlush();
  await provider.shutdown();

  return JSON.stringify({
    message: "Evaluation recorded successfully",
    evaluator: params.evaluator_name,
    passed: params.passed,
  }, null, 2);
}
```

## Limitations and Workarounds

### add_span Tool

**Challenge**: Adding a span to an existing trace requires reconstructing the trace context from a trace_id, which is complex with OpenTelemetry.

**Workaround**: Agents should use SDK instrumentation for adding spans:

```typescript
// In agent code (not MCP)
import { langwatch } from '@langwatch/observability';

@langwatch.span({ type: "agent_skill", name: "code-generation" })
async function generateCode(prompt: string): Promise<string> {
  // This automatically creates a span nested under the current trace
  return await claudeClient.generate(prompt);
}
```

**Why this is better**:
- Automatic parent-child relationships
- Proper context propagation
- Less error-prone
- More natural developer experience

### When to Use MCP vs SDK

| Use Case | Recommended Approach |
|----------|---------------------|
| Create initial trace | MCP `create_trace` tool |
| Add nested spans during execution | SDK `@langwatch.span` decorator |
| Record evaluation results | MCP `record_evaluation` tool |
| Search/retrieve traces | MCP `search_traces`, `get_trace` tools |

## Testing Strategy

### Unit Tests

```typescript
describe("create_trace MCP tool", () => {
  it("creates trace via OTLP", async () => {
    const result = await handleCreateTrace({
      name: "test-agent",
      input: "Hello world",
      metadata: { user_id: "user123" },
    });
    
    const parsed = JSON.parse(result);
    expect(parsed.trace_id).toBeDefined();
    expect(parsed.trace_id).toHaveLength(32); // OpenTelemetry trace ID format
  });
});
```

### Integration Tests

```typescript
describe("create_trace integration", () => {
  it("creates trace visible in LangWatch", async () => {
    // Create trace via MCP
    const createResult = await handleCreateTrace({
      name: "integration-test",
      input: "test input",
    });
    
    const { trace_id } = JSON.parse(createResult);
    
    // Wait for ingestion
    await sleep(2000);
    
    // Verify trace exists via search
    const searchResult = await handleSearchTraces({
      filters: { trace_id: [trace_id] },
    });
    
    expect(searchResult).toContain(trace_id);
  });
});
```

## Migration Path

1. **Phase 1**: Implement `create_trace` and `record_evaluation` with OTLP wrapper
2. **Phase 2**: Update documentation to recommend SDK for span creation
3. **Phase 3**: (Optional) If `add_span` is really needed, implement REST API later

## Conclusion

The OTLP wrapper approach provides:
- ✅ 75% reduction in implementation time (2-4 hours vs 8-16 hours)
- ✅ Zero backend changes
- ✅ Production-ready from day one (reuses existing pipeline)
- ✅ Natural developer experience (SDK for spans, MCP for trace management)

This is the **pragmatic choice** that unblocks the feature quickly while maintaining quality and consistency.
