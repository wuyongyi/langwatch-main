# Claude Code Agent Integration - Span Types and Attributes

This reference documents all available span types and their required/optional attributes for Claude Code agent instrumentation.

## Span Types Overview

LangWatch supports the following span types for agent instrumentation:

| Span Type | Purpose | Common Use Cases |
|-----------|---------|------------------|
| `agent` | Root span for agent execution | Agent entry points, complete workflows |
| `agent_skill` | Individual skill execution | Code generation, data analysis, tool usage |
| `llm` | LLM API call | Claude API calls, other LLM providers |
| `tool` | External tool invocation | API calls, database queries, file operations |
| `chain` | Sequence of operations | Multi-step workflows, pipelines |
| `retriever` | Data retrieval operation | RAG context retrieval, database lookups |

## Span Type Details

### 1. Agent Span

**Purpose**: Represents a complete agent execution from user request to final response.

**When to use**: 
- Agent entry points
- Complete task executions
- User-facing operations

**Required Attributes**:
- `langwatch.span.type`: "agent"
- Input (via `span.setInput()`)
- Output (via `span.setOutput()`)

**Optional Attributes**:
- `langwatch.user.id`: User identifier
- `langwatch.thread.id`: Conversation thread ID
- `langwatch.task.type`: Task classification (e.g., "code-generation", "qa", "data-analysis")
- `langwatch.risk.level`: Risk classification ("low", "medium", "high")

**Example**:

```typescript
import { trace } from "langwatch/observability";

class MyAgent {
  @trace({ name: "agent-execution" })
  async execute(userRequest: string): Promise<string> {
    // Agent logic
    return response;
  }
}

// Or manually:
const tracer = getLangWatchTracer("my-agent");
await tracer.withActiveSpan("agent-execution", async (span) => {
  span.setType("agent");
  span.setInput(userRequest);
  span.setAttribute("langwatch.user.id", userId);
  span.setAttribute("langwatch.thread.id", threadId);
  span.setAttribute("langwatch.task.type", "code-generation");
  
  const response = await processRequest(userRequest);
  span.setOutput(response);
});
```

### 2. Agent Skill Span

**Purpose**: Represents execution of a specific agent skill or capability.

**When to use**:
- Individual skill executions
- Discrete agent capabilities
- Sub-operations within agent workflow

**Required Attributes**:
- `langwatch.span.type`: "agent_skill"
- `langwatch.skill.name`: Skill identifier
- Input (via `span.setInput()`)
- Output (via `span.setOutput()`)

**Optional Attributes**:
- `langwatch.risk.level`: Risk classification
- Custom metadata via `span.setAttribute()`

**Example**:

```typescript
import { span } from "langwatch/observability";

class MyAgent {
  @span({ type: "agent_skill", name: "code-generation" })
  async generateCode(prompt: string): Promise<string> {
    // Code generation logic
    return code;
  }

  @span({ type: "agent_skill", name: "code-review" })
  async reviewCode(code: string): Promise<string> {
    // Code review logic
    return feedback;
  }
}

// Or manually:
await tracer.withActiveSpan("code-generation", async (span) => {
  span.setType("agent_skill");
  span.setAttribute("langwatch.skill.name", "code-generation");
  span.setInput(prompt);
  
  const code = await generateCode(prompt);
  span.setOutput(code);
});
```

### 3. LLM Span

**Purpose**: Represents an LLM API call with token usage and cost tracking.

**When to use**:
- Claude API calls
- Other LLM provider calls
- Any generative model invocation

**Required Attributes**:
- `langwatch.span.type`: "llm"
- `gen_ai.system`: Provider name (e.g., "anthropic", "openai")
- `gen_ai.request.model`: Model name
- Input (via `span.setInput()`)
- Output (via `span.setOutput()`)

**Optional Attributes** (automatically captured by auto-instrumentation):
- `gen_ai.response.model`: Actual model used
- `gen_ai.usage.prompt_tokens`: Input tokens
- `gen_ai.usage.completion_tokens`: Output tokens
- `gen_ai.request.max_tokens`: Max tokens setting
- `gen_ai.request.temperature`: Temperature setting
- `langwatch.cost`: Calculated cost in USD

**Example**:

```typescript
// Auto-instrumentation (recommended):
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";

const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// All calls automatically create LLM spans with full attributes
const response = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  temperature: 0.7,
  messages: [{ role: "user", content: "Hello!" }]
});

// Manual instrumentation:
await tracer.withActiveSpan("llm-call", async (span) => {
  span.setType("llm");
  span.setAttribute("gen_ai.system", "anthropic");
  span.setAttribute("gen_ai.request.model", "claude-3-5-sonnet-20241022");
  span.setAttribute("gen_ai.request.temperature", 0.7);
  span.setInput(messages);
  
  const response = await client.messages.create({...});
  
  span.setOutput(response.content);
  span.setMetrics({
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    cost: calculateCost(response.usage, model)
  });
});
```

### 4. Tool Span

**Purpose**: Represents invocation of an external tool or service.

**When to use**:
- API calls to external services
- Database queries
- File system operations
- Command execution

**Required Attributes**:
- `langwatch.span.type`: "tool"
- Tool name (in span name)
- Input (via `span.setInput()`)
- Output (via `span.setOutput()`)

**Optional Attributes**:
- `tool.name`: Tool identifier
- `http.method`: HTTP method for API calls
- `http.url`: URL for API calls
- `http.status_code`: Response status code

**Example**:

```typescript
@span({ type: "tool", name: "github-api" })
async fetchGitHubRepo(owner: string, repo: string): Promise<any> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await fetch(url);
  return await response.json();
}

// Or manually:
await tracer.withActiveSpan("github-api", async (span) => {
  span.setType("tool");
  span.setAttribute("tool.name", "github-api");
  span.setAttribute("http.method", "GET");
  span.setAttribute("http.url", url);
  span.setInput({ owner, repo });
  
  const response = await fetch(url);
  span.setAttribute("http.status_code", response.status);
  
  const data = await response.json();
  span.setOutput(data);
});
```

### 5. Chain Span

**Purpose**: Represents a sequence of operations or a workflow.

**When to use**:
- Multi-step workflows
- Processing pipelines
- Orchestration logic

**Required Attributes**:
- `langwatch.span.type`: "chain"
- Input (via `span.setInput()`)
- Output (via `span.setOutput()`)

**Optional Attributes**:
- `chain.steps`: Number of steps
- Custom metadata for workflow state

**Example**:

```typescript
@span({ type: "chain", name: "code-generation-pipeline" })
async generateAndValidateCode(prompt: string): Promise<string> {
  // Step 1: Generate code
  const code = await this.generateCode(prompt);
  
  // Step 2: Validate syntax
  const isValid = await this.validateSyntax(code);
  
  // Step 3: Run tests
  const testResults = await this.runTests(code);
  
  return code;
}

// Or manually:
await tracer.withActiveSpan("code-pipeline", async (span) => {
  span.setType("chain");
  span.setAttribute("chain.steps", 3);
  span.setInput(prompt);
  
  const code = await generateCode(prompt);
  await validateSyntax(code);
  await runTests(code);
  
  span.setOutput(code);
});
```

### 6. Retriever Span

**Purpose**: Represents data retrieval operations, especially for RAG.

**When to use**:
- Vector database queries
- Document retrieval
- Context gathering for RAG
- Database lookups

**Required Attributes**:
- `langwatch.span.type`: "retriever"
- Input (via `span.setInput()`)
- Output (via `span.setOutput()`)

**Optional Attributes**:
- `retriever.query`: Search query
- `retriever.top_k`: Number of results requested
- RAG contexts (via `span.setRAGContexts()`)

**Example**:

```typescript
@span({ type: "retriever", name: "vector-search" })
async retrieveContext(query: string, topK: number = 5): Promise<string[]> {
  const results = await this.vectorDB.search(query, topK);
  return results.map(r => r.content);
}

// Or manually:
await tracer.withActiveSpan("vector-search", async (span) => {
  span.setType("retriever");
  span.setAttribute("retriever.query", query);
  span.setAttribute("retriever.top_k", topK);
  span.setInput(query);
  
  const results = await vectorDB.search(query, topK);
  
  // Set RAG contexts for better observability
  span.setRAGContexts(results.map(r => ({
    document_id: r.id,
    chunk_id: r.chunkId,
    content: r.content,
    score: r.score
  })));
  
  span.setOutput(results.map(r => r.content));
});
```

## Standard OpenTelemetry Attributes

LangWatch follows OpenTelemetry semantic conventions where applicable:

### GenAI Attributes (for LLM spans)

| Attribute | Type | Description |
|-----------|------|-------------|
| `gen_ai.system` | string | Provider name ("anthropic", "openai", etc.) |
| `gen_ai.request.model` | string | Requested model name |
| `gen_ai.response.model` | string | Actual model used |
| `gen_ai.usage.prompt_tokens` | number | Input tokens |
| `gen_ai.usage.completion_tokens` | number | Output tokens |
| `gen_ai.request.max_tokens` | number | Max tokens setting |
| `gen_ai.request.temperature` | number | Temperature setting |
| `gen_ai.request.top_p` | number | Top-p setting |

### HTTP Attributes (for tool spans)

| Attribute | Type | Description |
|-----------|------|-------------|
| `http.method` | string | HTTP method (GET, POST, etc.) |
| `http.url` | string | Full URL |
| `http.status_code` | number | Response status code |
| `http.request.body` | string | Request body (if captured) |
| `http.response.body` | string | Response body (if captured) |

## LangWatch Custom Attributes

### Metadata Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `langwatch.span.type` | string | Span type classification |
| `langwatch.user.id` | string | User identifier |
| `langwatch.thread.id` | string | Conversation thread ID |
| `langwatch.task.type` | string | Task classification |
| `langwatch.skill.name` | string | Skill identifier |
| `langwatch.risk.level` | string | Risk level ("low", "medium", "high") |
| `langwatch.risk.reason` | string | Risk classification reason |
| `langwatch.cost` | number | Calculated cost in USD |

### Custom Metadata

You can attach any custom metadata using `span.setAttribute()`:

```typescript
span.setAttribute("custom.environment", "production");
span.setAttribute("custom.version", "1.0.0");
span.setAttribute("custom.feature_flag", true);
span.setAttribute("custom.retry_count", 3);
```

## Input/Output Formats

Spans support multiple input/output formats:

### Text Format

```typescript
span.setInput("User prompt text");
span.setOutput("Model response text");
```

### JSON Format

```typescript
span.setInput({ query: "search term", filters: ["tag1", "tag2"] });
span.setOutput({ results: [...], count: 10 });
```

### Chat Messages Format

```typescript
span.setInput([
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "Hello!" }
]);
span.setOutput([
  { role: "assistant", content: "Hi! How can I help?" }
]);
```

## RAG Context Format

For retriever spans, use `setRAGContexts()` to capture retrieved documents:

```typescript
span.setRAGContexts([
  {
    document_id: "doc-123",
    chunk_id: "chunk-456",
    content: "Retrieved text content...",
    score: 0.95
  },
  {
    document_id: "doc-124",
    chunk_id: "chunk-457",
    content: "Another retrieved chunk...",
    score: 0.87
  }
]);
```

## Metrics Format

Use `setMetrics()` to capture performance and cost metrics:

```typescript
span.setMetrics({
  promptTokens: 150,
  completionTokens: 300,
  totalTokens: 450,
  cost: 0.0045,
  firstTokenMs: 250,
  completionTimeMs: 2500
});
```

## Error Handling

Errors are automatically captured when thrown within instrumented spans:

```typescript
await tracer.withActiveSpan("risky-operation", async (span) => {
  span.setType("agent_skill");
  span.setInput(input);
  
  try {
    const result = await riskyOperation();
    span.setOutput(result);
  } catch (error) {
    // Error is automatically captured with:
    // - error.has_error: true
    // - error.message: error message
    // - error.stacktrace: stack trace array
    throw error; // Re-throw to propagate
  }
});
```

## Best Practices

### 1. Use Appropriate Span Types

Choose the span type that best represents the operation:

```typescript
// ✅ Good: Specific span types
@span({ type: "agent_skill", name: "code-generation" })
async generateCode(prompt: string): Promise<string> { ... }

@span({ type: "llm", name: "claude-call" })
async callClaude(prompt: string): Promise<string> { ... }

// ❌ Bad: Generic span types
@span({ type: "agent", name: "everything" })
async doEverything(): Promise<string> { ... }
```

### 2. Capture Meaningful Input/Output

Include enough context for debugging:

```typescript
// ✅ Good: Structured input/output
span.setInput({
  query: "search term",
  filters: { category: "code" },
  limit: 10
});

// ❌ Bad: Minimal context
span.setInput("search");
```

### 3. Use Metadata for Filtering

Add metadata that helps filter and analyze traces:

```typescript
span.setAttribute("langwatch.user.id", userId);
span.setAttribute("langwatch.task.type", "code-generation");
span.setAttribute("langwatch.risk.level", "high");
```

### 4. Nest Spans Properly

Create proper hierarchies for complex operations:

```typescript
@trace({ name: "agent-execution" })
async execute(task: string): Promise<string> {
  // Root trace
  
  const context = await this.retrieveContext(task); // Creates retriever span
  const code = await this.generateCode(task, context); // Creates agent_skill span
  const validated = await this.validate(code); // Creates tool span
  
  return validated;
}
```

## Next Steps

- [Quickstart Guide](./CLAUDE_AGENT_QUICKSTART.md) - Get started with instrumentation
- [Instrumentation Patterns](./CLAUDE_AGENT_PATTERNS.md) - Advanced patterns and examples
- [Troubleshooting Guide](./CLAUDE_AGENT_TROUBLESHOOTING.md) - Common issues and solutions

## Support

- [LangWatch Documentation](https://docs.langwatch.ai)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [GitHub Issues](https://github.com/langwatch/langwatch/issues)
