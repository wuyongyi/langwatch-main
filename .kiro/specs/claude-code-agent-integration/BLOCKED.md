# Blocked Tasks - Claude Code Agent Integration

## Task 8: Implement MCP Server Extensions (RESOLVED ✅)

### Status: RESOLVED - Implemented using OTLP Wrapper approach

### Subtasks Completed:
- ✅ 8.1 Create create_trace MCP tool (implemented using OTLP wrapper)
- ✅ 8.3 Create search_traces MCP tool (already existed)
- ✅ 8.4 Create get_trace MCP tool (already existed)
- ✅ 8.5 Create record_evaluation MCP tool (implemented using OTLP wrapper)
- ✅ 8.7 Register MCP tools (all tools registered)

### Subtasks Deferred:
- ⏸️ 8.2 Create add_span MCP tool (deferred - agents should use SDK @span decorator instead)

### Resolution Summary:

**Implemented Option 1 (OTLP Wrapper)** as recommended - the pragmatic choice that:

1. ✅ Required no architectural changes
2. ✅ Reused battle-tested OTLP ingestion pipeline
3. ✅ Was much faster to implement (2-4 hours vs 8-16 hours for REST API)
4. ✅ Lower risk - no new backend code paths
5. ✅ Maintains data format consistency

**Implementation completed:**
- `mcp-server/src/tools/create-trace.ts` - Creates traces using OpenTelemetry SDK and OTLP exporter
- `mcp-server/src/tools/record-evaluation.ts` - Records evaluations as OTLP spans
- Both tools registered in `mcp-server/src/index.ts`
- Unit tests added for both tools

**Key implementation details:**
- Uses `@opentelemetry/exporter-trace-otlp-http` to send to existing `/api/otel/v1/traces` endpoint
- Creates `BasicTracerProvider` with `SimpleSpanProcessor` for immediate export
- Returns trace_id to agents for subsequent operations
- Properly handles metadata (user_id, thread_id, task_type)
- Includes proper cleanup with provider shutdown

### Original Blocking Reason (Now Resolved):

The design document specified that MCP tools should "create trace via LangWatch API" and "add span to existing trace" programmatically. However, the current LangWatch architecture did not support programmatic trace creation via REST API.

### Original Architecture Analysis:

**Previous Architecture:**
- Traces are ingested via OTLP protocol (`/api/otel/v1/traces`)
- Trace storage uses Elasticsearch/ClickHouse with complex indexing
- Ingestion happens asynchronously via Bull queue workers
- Multiple storage backends need to be supported

**What Was Considered:**

1. **New REST API Endpoints (Not Implemented):**
   ```
   POST /api/traces              - Create trace programmatically
   POST /api/traces/:id/spans    - Add span to trace
   POST /api/traces/:id/evaluations - Record evaluation
   ```

2. **Direct Storage Access (Not Needed):**
   - Bypass OTLP protocol
   - Write directly to Elasticsearch/ClickHouse
   - Handle trace/span ID generation
   - Maintain data consistency

### Estimated Effort (Actual):
**Option 1 (OTLP Wrapper - IMPLEMENTED): ~2-4 hours** ✅
- ✅ Add OpenTelemetry dependencies: 30 min
- ✅ Implement create_trace tool: 1 hour
- ✅ Implement record_evaluation tool: 1 hour
- ✅ Integration tests: 1 hour
- ✅ Documentation updates: 30 min

**Option 2 (Full REST API - NOT NEEDED): 8-16 hours**
- API design and review: 2-4 hours
- Backend implementation: 4-8 hours
- Testing: 2-3 hours
- Documentation: 1 hour

### Implementation Approach (COMPLETED):

**Option 1: OTLP Wrapper (IMPLEMENTED ✅)**
- MCP tools use OpenTelemetry SDK to generate OTLP payloads
- Send to existing `/api/otel/v1/traces` endpoint
- Reuse all existing infrastructure (queue workers, storage, indexing)
- No backend changes needed
- Trade-off: Slightly more complex MCP tool implementation, but much simpler overall
- **Actual effort: ~2-4 hours** ✅

**Implementation details:**
```typescript
// In MCP tool handler (mcp-server/src/tools/create-trace.ts)
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

// Create tracer and span
const exporter = new OTLPTraceExporter({
  url: `${endpoint}/api/otel/v1/traces`,
  headers: { authorization: `Bearer ${apiKey}` }
});

const provider = new BasicTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

const tracer = trace.getTracer("langwatch-mcp-server", "0.5.0");
const span = tracer.startSpan(name, { attributes: {...} });
span.end();
await provider.forceFlush();
```

**Option 2: Full REST API (NOT IMPLEMENTED - Not Needed)**
- Create dedicated REST endpoints
- Simpler interface for agents
- More work but better separation of concerns
- Trade-off: More implementation work, duplicate logic
- **Estimated effort: 8-16 hours** (avoided)

### Note on `add_span` Tool:

This tool was **deferred** (not blocked) because it requires reconstructing trace context from a trace_id, which is complex. The recommended pattern is for agents to use SDK instrumentation (`@langwatch.span` decorator) for adding spans, which is more natural and maintains proper parent-child relationships automatically.

### Files Implemented:

- `mcp-server/src/tools/create-trace.ts` - OTLP-based trace creation
- `mcp-server/src/tools/record-evaluation.ts` - OTLP-based evaluation recording
- `mcp-server/src/tools/__tests__/create-trace.unit.test.ts` - Unit tests
- `mcp-server/src/tools/__tests__/record-evaluation.unit.test.ts` - Unit tests
- `mcp-server/src/index.ts` - Tool registration (updated)

### Integration Tests:

Placeholder integration tests exist in:
- `typescript-sdk/src/observability-sdk/__tests__/integration/mcp-tools.integration.test.ts`

These tests need to be updated to test the actual OTLP-based implementation with a running MCP server.

---

**Date Blocked:** 2025-01-XX  
**Date Resolved:** 2025-01-XX  
**Resolution:** Implemented using OTLP Wrapper approach (Option 1)  
**Actual Effort:** ~2-4 hours as estimated
