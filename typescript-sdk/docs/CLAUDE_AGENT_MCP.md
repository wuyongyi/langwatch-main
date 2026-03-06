# Claude Code Agent Integration - MCP Guide

This guide shows you how to use the LangWatch MCP server to enable your Claude Code agents to interact with LangWatch programmatically.

## What is MCP?

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) allows AI agents to access external tools and data sources. The LangWatch MCP server provides tools for:

- Searching and retrieving traces
- Querying analytics data
- Managing prompts
- Accessing documentation

## MCP Server Setup

### Installation

Add the LangWatch MCP server to your MCP client configuration:

**For Claude Code:**

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

**Quick setup with CLI:**

```bash
claude mcp add langwatch -- npx -y @langwatch/mcp-server --apiKey your-api-key-here
```

### Configuration Options

| Environment Variable | CLI Argument | Description |
|---------------------|--------------|-------------|
| `LANGWATCH_API_KEY` | `--apiKey` | Your LangWatch API key (required) |
| `LANGWATCH_ENDPOINT` | `--endpoint` | API endpoint (default: `https://app.langwatch.ai`) |

## Available MCP Tools

### Observability Tools

#### create_trace

Create a new trace for agent execution:

```typescript
// Agent code example
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
```

**Parameters:**
- `name` (string, required): Trace name (e.g., "user-query", "code-generation")
- `input` (string, required): Agent input or user request
- `metadata` (object, optional): Metadata for filtering and grouping
  - `user_id` (string): User identifier
  - `thread_id` (string): Conversation thread ID
  - `task_type` (string): Task classification

**Note:** To add child spans during execution, use SDK instrumentation (`@langwatch.span` decorator) rather than MCP tools. This provides automatic parent-child relationships and proper context propagation.

#### record_evaluation

Record an evaluation result for a trace:

```typescript
const result = await mcp.call("record_evaluation", {
  trace_id: "abc123...",
  evaluator_name: "code-correctness",
  passed: true,
  score: 0.95,
  details: "Code compiles and passes all tests"
});
```

**Parameters:**
- `trace_id` (string, required): The trace ID to attach evaluation to
- `evaluator_name` (string, required): Evaluator identifier (e.g., "code-correctness", "response-accuracy")
- `passed` (boolean, required): Whether the evaluation passed
- `score` (number, optional): Numeric score (0.0 to 1.0)
- `details` (string, optional): Additional evaluation details or feedback

#### search_traces

Search for traces with filters and text queries:

```typescript
// Agent code example
const traces = await mcp.call("search_traces", {
  filters: {
    "metadata.user_id": ["user-123"],
    "metadata.task_type": ["code-generation"]
  },
  textQuery: "error",
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
  pageSize: 10,
  format: "digest" // or "json"
});
```

**Parameters:**
- `filters` (object): Key-value filters for metadata
- `textQuery` (string): Full-text search query
- `startDate` (string): ISO 8601 start date
- `endDate` (string): ISO 8601 end date
- `pageSize` (number): Results per page (default: 25)
- `scrollId` (string): Pagination token from previous response
- `format` (string): "digest" (AI-readable) or "json" (raw data)

#### get_trace

Retrieve complete trace details:

```typescript
const trace = await mcp.call("get_trace", {
  traceId: "trace-abc123",
  format: "digest"
});
```

**Parameters:**
- `traceId` (string, required): Trace identifier
- `format` (string): "digest" or "json"

#### discover_schema

Explore available filters, metrics, and aggregations:

```typescript
const schema = await mcp.call("discover_schema", {});
```

Returns available:
- Filter fields and their types
- Metric categories and names
- Aggregation functions
- Grouping dimensions

#### get_analytics

Query timeseries analytics data:

```typescript
const analytics = await mcp.call("get_analytics", {
  metrics: ["performance.completion_time", "cost.total_cost"],
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
  groupBy: ["metadata.task_type"],
  filters: {
    "metadata.user_id": ["user-123"]
  }
});
```

**Parameters:**
- `metrics` (array): Metric names in `category.name` format
- `startDate` (string): ISO 8601 start date
- `endDate` (string): ISO 8601 end date
- `groupBy` (array): Dimensions to group by
- `filters` (object): Key-value filters

### Prompt Management Tools

#### list_prompts

List all prompts in your project:

```typescript
const prompts = await mcp.call("list_prompts", {});
```

#### get_prompt

Get prompt details with version history:

```typescript
const prompt = await mcp.call("get_prompt", {
  promptId: "prompt-123"
});
```

#### create_prompt

Create a new prompt:

```typescript
const newPrompt = await mcp.call("create_prompt", {
  name: "Code Review Prompt",
  messages: [
    {
      role: "system",
      content: "You are a code reviewer."
    },
    {
      role: "user",
      content: "Review this code: {{code}}"
    }
  ]
});
```

#### update_prompt

Update an existing prompt or create a new version:

```typescript
const updated = await mcp.call("update_prompt", {
  promptId: "prompt-123",
  messages: [
    {
      role: "system",
      content: "You are an expert code reviewer."
    }
  ],
  createVersion: true // Create new version instead of overwriting
});
```

### Documentation Tools

#### fetch_langwatch_docs

Fetch LangWatch integration documentation:

```typescript
const docs = await mcp.call("fetch_langwatch_docs", {
  topic: "typescript-sdk" // or "python-sdk", "api", etc.
});
```

#### fetch_scenario_docs

Fetch scenario testing documentation:

```typescript
const scenarioDocs = await mcp.call("fetch_scenario_docs", {});
```

## Usage Patterns

### Pattern 1: Agent with Programmatic Trace Creation

An agent that creates its own traces via MCP:

```typescript
class MCPInstrumentedAgent {
  async execute(userRequest: string): Promise<string> {
    // Create trace via MCP
    const traceResult = await mcp.call("create_trace", {
      name: "agent-execution",
      input: userRequest,
      metadata: {
        user_id: this.userId,
        thread_id: this.threadId,
        task_type: "code-generation"
      }
    });
    
    const traceId = JSON.parse(traceResult).trace_id;
    
    try {
      // Execute agent logic with SDK instrumentation for spans
      const result = await this.performTask(userRequest);
      
      // Record evaluation via MCP
      await mcp.call("record_evaluation", {
        trace_id: traceId,
        evaluator_name: "task-completion",
        passed: true,
        score: 0.95,
        details: "Task completed successfully"
      });
      
      return result;
    } catch (error) {
      // Record failure evaluation
      await mcp.call("record_evaluation", {
        trace_id: traceId,
        evaluator_name: "task-completion",
        passed: false,
        score: 0.0,
        details: `Error: ${error.message}`
      });
      
      throw error;
    }
  }
  
  // Use SDK for child spans
  @span({ type: "agent_skill", name: "task-execution" })
  async performTask(request: string): Promise<string> {
    // Task implementation
    return "result";
  }
}
```

### Pattern 2: Self-Monitoring Agent

An agent that monitors its own performance:

```typescript
import { trace, span } from "langwatch/observability";

class SelfMonitoringAgent {
  @trace({ name: "agent-with-monitoring" })
  async execute(task: string): Promise<string> {
    // Execute the task
    const result = await this.performTask(task);
    
    // Check recent performance
    await this.checkPerformance();
    
    return result;
  }

  @span({ type: "agent_skill", name: "performance-check" })
  async checkPerformance(): Promise<void> {
    // Use MCP to query recent traces
    const recentTraces = await mcp.call("search_traces", {
      filters: {
        "metadata.task_type": ["agent-execution"]
      },
      startDate: new Date(Date.now() - 3600000).toISOString(), // Last hour
      pageSize: 10
    });
    
    // Analyze error rate
    const errorCount = recentTraces.traces.filter(t => t.error).length;
    const errorRate = errorCount / recentTraces.traces.length;
    
    if (errorRate > 0.1) {
      console.warn(`High error rate detected: ${errorRate * 100}%`);
    }
  }
}
```

### Pattern 2: Adaptive Agent

An agent that adapts based on past performance:

```typescript
class AdaptiveAgent {
  @trace({ name: "adaptive-agent" })
  async execute(query: string): Promise<string> {
    // Get analytics to determine best approach
    const analytics = await this.analyzeHistoricalPerformance(query);
    
    // Choose strategy based on past success
    const strategy = this.selectStrategy(analytics);
    
    return await this.executeWithStrategy(query, strategy);
  }

  @span({ type: "agent_skill", name: "historical-analysis" })
  async analyzeHistoricalPerformance(query: string): Promise<any> {
    return await mcp.call("get_analytics", {
      metrics: ["performance.completion_time", "quality.success_rate"],
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(), // Last 7 days
      endDate: new Date().toISOString(),
      groupBy: ["metadata.strategy"]
    });
  }
}
```

### Pattern 3: Learning from Examples

An agent that retrieves successful examples:

```typescript
class ExampleLearningAgent {
  @span({ type: "agent_skill", name: "retrieve-examples" })
  async getSuccessfulExamples(taskType: string): Promise<any[]> {
    const traces = await mcp.call("search_traces", {
      filters: {
        "metadata.task_type": [taskType],
        "error.has_error": ["false"]
      },
      pageSize: 5,
      format: "json"
    });
    
    return traces.traces.map(t => ({
      input: t.input,
      output: t.output,
      approach: t.metadata.approach
    }));
  }

  @trace({ name: "learning-agent" })
  async execute(task: string, taskType: string): Promise<string> {
    // Learn from successful examples
    const examples = await this.getSuccessfulExamples(taskType);
    
    // Use examples to inform approach
    const prompt = this.buildPromptWithExamples(task, examples);
    
    return await this.generateResponse(prompt);
  }
}
```

## Output Formats

### Digest Format (AI-Readable)

The `digest` format provides a hierarchical, human-readable view optimized for LLM consumption:

```
Trace: agent-execution (trace-abc123)
Status: success
Duration: 2.5s
Input: "Generate a sorting function"
Output: "def sort_list(items): ..."

Spans:
├─ context-retrieval (150ms)
│  Input: "sorting function"
│  Output: ["Example 1", "Example 2"]
│
└─ code-generation (2.3s)
   ├─ llm-call (2.2s)
   │  Model: claude-3-5-sonnet-20241022
   │  Tokens: 150 prompt + 300 completion
   │  Cost: $0.0045
   │  Input: "Generate a Python sorting function..."
   │  Output: "def sort_list(items): ..."
   │
   └─ validation (100ms)
      Input: "def sort_list(items): ..."
      Output: "valid"
```

### JSON Format (Raw Data)

The `json` format provides complete trace data with all fields for programmatic access.

## Best Practices

### 1. Use Digest Format for Analysis

When analyzing traces for patterns or debugging, use `format: "digest"` for better LLM comprehension:

```typescript
const trace = await mcp.call("get_trace", {
  traceId: traceId,
  format: "digest"
});
```

### 2. Paginate Large Result Sets

Use `scrollId` for pagination when searching many traces:

```typescript
let scrollId = null;
const allTraces = [];

do {
  const response = await mcp.call("search_traces", {
    filters: { "metadata.user_id": ["user-123"] },
    pageSize: 100,
    scrollId: scrollId
  });
  
  allTraces.push(...response.traces);
  scrollId = response.scrollId;
} while (scrollId);
```

### 3. Discover Schema First

Before querying analytics, use `discover_schema` to understand available metrics:

```typescript
const schema = await mcp.call("discover_schema", {});
console.log("Available metrics:", schema.metrics);
console.log("Available filters:", schema.filters);
```

### 4. Combine SDK and MCP

Use SDK for instrumentation and MCP for querying:

```typescript
// Instrument with SDK
@trace({ name: "agent-execution" })
async execute(task: string): Promise<string> {
  const result = await this.performTask(task);
  
  // Query with MCP
  const similar = await this.findSimilarExecutions(task);
  
  return result;
}
```

## Troubleshooting

### MCP Server Not Found

If the agent can't find the MCP server:

1. Verify the server is in your MCP configuration
2. Check that `LANGWATCH_API_KEY` is set
3. Restart your MCP client

### Authentication Errors

If you get authentication errors:

1. Verify your API key is correct
2. Check that the key has the required permissions
3. Ensure the key is not expired

### Empty Results

If searches return no results:

1. Verify traces exist in the date range
2. Check filter syntax (use arrays for values)
3. Try removing filters to broaden the search

## Next Steps

- [Quickstart Guide](./CLAUDE_AGENT_QUICKSTART.md) - SDK instrumentation basics
- [Span Types Reference](./CLAUDE_AGENT_SPAN_TYPES.md) - Complete span types and attributes
- [Troubleshooting Guide](./CLAUDE_AGENT_TROUBLESHOOTING.md) - Common issues and solutions

## Support

- [MCP Server Repository](https://github.com/langwatch/langwatch/tree/main/mcp-server)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [LangWatch Documentation](https://docs.langwatch.ai)
