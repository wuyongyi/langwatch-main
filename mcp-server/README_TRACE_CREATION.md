# MCP Trace Creation Tools

This document describes the new MCP tools for programmatic trace creation and evaluation recording.

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
pnpm install
```

### 2. Configure MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "langwatch": {
      "command": "npx",
      "args": ["-y", "@langwatch/mcp-server"],
      "env": {
        "LANGWATCH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 3. Use the Tools

#### Create a Trace

```typescript
const result = await mcp.call("create_trace", {
  name: "agent-execution",
  input: "User request: Generate a sorting function",
  metadata: {
    user_id: "user-123",
    thread_id: "thread-456",
    task_type: "code-generation"
  }
});

// Returns: { trace_id: "abc123...", message: "Trace created successfully" }
const traceId = JSON.parse(result).trace_id;
```

#### Record an Evaluation

```typescript
await mcp.call("record_evaluation", {
  trace_id: traceId,
  evaluator_name: "code-correctness",
  passed: true,
  score: 0.95,
  details: "Code compiles and passes all tests"
});
```

## Implementation Details

### Architecture

These tools use the **OTLP Wrapper** approach:

1. MCP tools use OpenTelemetry SDK to generate OTLP-formatted data
2. Send to existing `/api/otel/v1/traces` endpoint
3. Reuse all existing LangWatch infrastructure

**Benefits:**
- No backend changes needed
- Reuses battle-tested OTLP pipeline
- Fast implementation (2-4 hours vs 8-16 hours for REST API)
- Production-ready from day one

### Why Not add_span?

Adding spans to existing traces via MCP is complex and error-prone. Instead, use SDK instrumentation:

```typescript
import { span } from "@langwatch/observability";

@span({ type: "agent_skill", name: "my-skill" })
async function mySkill() {
  // Automatically creates nested span with proper context
}
```

This provides:
- Automatic parent-child relationships
- Proper context propagation
- Better developer experience

## Usage Patterns

### Pattern 1: MCP Trace + SDK Spans

```typescript
// Create trace via MCP
const traceResult = await mcp.call("create_trace", {
  name: "agent-execution",
  input: userRequest,
  metadata: { user_id: "user-123" }
});

const traceId = JSON.parse(traceResult).trace_id;

// Add spans via SDK (automatic nesting)
@span({ type: "agent_skill", name: "task-execution" })
async function performTask() {
  // Implementation
}

// Record evaluation via MCP
await mcp.call("record_evaluation", {
  trace_id: traceId,
  evaluator_name: "task-completion",
  passed: true,
  score: 0.95
});
```

### Pattern 2: Error Handling

```typescript
const traceResult = await mcp.call("create_trace", {
  name: "agent-execution",
  input: userRequest
});

const traceId = JSON.parse(traceResult).trace_id;

try {
  const result = await performTask();
  
  // Success evaluation
  await mcp.call("record_evaluation", {
    trace_id: traceId,
    evaluator_name: "task-completion",
    passed: true,
    score: 1.0
  });
  
  return result;
} catch (error) {
  // Failure evaluation
  await mcp.call("record_evaluation", {
    trace_id: traceId,
    evaluator_name: "task-completion",
    passed: false,
    score: 0.0,
    details: `Error: ${error.message}`
  });
  
  throw error;
}
```

## Testing

Run unit tests:

```bash
cd mcp-server
npx vitest run src/tools/__tests__/create-trace.unit.test.ts
npx vitest run src/tools/__tests__/record-evaluation.unit.test.ts
```

All tests should pass:
```
✓ create-trace.unit.test.ts (5 tests)
✓ record-evaluation.unit.test.ts (5 tests)
```

## API Reference

### create_trace

Creates a new trace for agent execution.

**Parameters:**
- `name` (string, required): Trace name
- `input` (string, required): Agent input or user request
- `metadata` (object, optional):
  - `user_id` (string): User identifier
  - `thread_id` (string): Conversation thread ID
  - `task_type` (string): Task classification

**Returns:**
```json
{
  "trace_id": "abc123...",
  "message": "Trace created successfully via OTLP",
  "note": "Use SDK instrumentation (@langwatch.span decorator) to add child spans"
}
```

### record_evaluation

Records an evaluation result for a trace.

**Parameters:**
- `trace_id` (string, required): The trace ID to attach evaluation to
- `evaluator_name` (string, required): Evaluator identifier
- `passed` (boolean, required): Whether the evaluation passed
- `score` (number, optional): Numeric score (0.0 to 1.0)
- `details` (string, optional): Additional evaluation details

**Returns:**
```json
{
  "message": "Evaluation recorded successfully",
  "evaluator": "code-correctness",
  "passed": true,
  "trace_id": "abc123..."
}
```

## Troubleshooting

### Traces Not Appearing

If traces don't appear in LangWatch:

1. Verify API key is correct
2. Check endpoint configuration (default: `https://app.langwatch.ai`)
3. Wait a few seconds for ingestion to complete
4. Check LangWatch project is active

### Authentication Errors

If you get authentication errors:

1. Verify `LANGWATCH_API_KEY` is set correctly
2. Check API key has required permissions
3. Ensure API key is not expired

## Further Reading

- [OTLP Wrapper Approach Guide](../.kiro/specs/claude-code-agent-integration/OTLP_WRAPPER_APPROACH.md)
- [MCP Integration Documentation](../typescript-sdk/docs/CLAUDE_AGENT_MCP.md)
- [Feature Specification](../specs/mcp-server/programmatic-trace-creation.feature)

## Support

- [GitHub Issues](https://github.com/langwatch/langwatch/issues)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [Documentation](https://docs.langwatch.ai)
