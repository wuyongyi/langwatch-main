# Claude Code Agent Integration - Quickstart Guide

This guide shows you how to instrument your Claude Code agents with LangWatch for comprehensive observability, evaluation, and testing.

## Installation

```bash
npm install langwatch
```

## Basic Setup

### 1. Initialize LangWatch

```typescript
import { setupObservability } from "langwatch/observability/node";

// Initialize with API key from environment variable
await setupObservability({
  serviceName: "my-claude-agent"
});
```

The `LANGWATCH_API_KEY` environment variable must be set. Get your API key from [LangWatch Dashboard](https://app.langwatch.ai).

### 2. Instrument Your Agent Entry Point

Use the `@trace` decorator to automatically create traces for agent executions:

```typescript
import { trace } from "langwatch/observability";
import { getLangWatchTracer } from "langwatch";

class MyClaudeAgent {
  @trace({ name: "agent-execution" })
  async handleRequest(userInput: string): Promise<string> {
    // Your agent logic here
    const response = await this.processRequest(userInput);
    return response;
  }
}
```

### 3. Instrument Individual Skills

Use the `@span` decorator to track individual skill executions:

```typescript
import { span } from "langwatch/observability";

class MyClaudeAgent {
  @span({ type: "agent_skill", name: "code-generation" })
  async generateCode(prompt: string): Promise<string> {
    // Code generation logic
    const code = await this.callLLM(prompt);
    return code;
  }

  @span({ type: "agent_skill", name: "data-analysis" })
  async analyzeData(data: any[]): Promise<string> {
    // Data analysis logic
    return analysis;
  }
}
```

### 4. Auto-Instrument Claude API Calls

Automatically track all Claude API calls with token usage and costs:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Wrap the client to enable auto-instrumentation
const instrumentedClient = instrumentClaudeClient(client);

// All API calls now automatically create LLM spans
const response = await instrumentedClient.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }]
});
```

## Complete Working Example

Here's a complete example of a Claude Code agent with full instrumentation:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { setupObservability } from "langwatch/observability/node";
import { trace, span } from "langwatch/observability";
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";

// Initialize LangWatch
await setupObservability({
  serviceName: "qa-agent",
  captureInput: true,
  captureOutput: true
});

// Setup instrumented Claude client
const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

class QAAgent {
  @trace({ name: "qa-agent-execution" })
  async answerQuestion(question: string): Promise<string> {
    // Retrieve relevant context
    const context = await this.retrieveContext(question);
    
    // Generate answer using Claude
    const answer = await this.generateAnswer(question, context);
    
    return answer;
  }

  @span({ type: "agent_skill", name: "context-retrieval" })
  async retrieveContext(question: string): Promise<string[]> {
    // Simulate context retrieval
    return [
      "Context document 1",
      "Context document 2"
    ];
  }

  @span({ type: "agent_skill", name: "answer-generation" })
  async generateAnswer(question: string, context: string[]): Promise<string> {
    const prompt = `Context:\n${context.join("\n\n")}\n\nQuestion: ${question}\n\nAnswer:`;
    
    // This call is automatically instrumented
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    
    return response.content[0].type === "text" 
      ? response.content[0].text 
      : "";
  }
}

// Usage
const agent = new QAAgent();
const answer = await agent.answerQuestion("What is the capital of France?");
console.log(answer);
```

## What Gets Captured

When you run this agent, LangWatch automatically captures:

- **Trace**: Complete agent execution from question to answer
- **Spans**: Individual operations (context retrieval, answer generation)
- **LLM Calls**: Model name, tokens, cost, latency, input/output
- **Errors**: Any exceptions with stack traces
- **Metadata**: Timestamps, execution duration, relationships

## View Your Traces

After running your agent, view traces in the [LangWatch Dashboard](https://app.langwatch.ai):

1. Navigate to **Traces** page
2. See your agent executions with timing and status
3. Click a trace to see the complete execution tree
4. Inspect inputs, outputs, and LLM calls
5. Analyze token usage and costs

## Next Steps

- [MCP Integration Guide](./CLAUDE_AGENT_MCP.md) - Use MCP tools for agent self-instrumentation
- [Span Types Reference](./CLAUDE_AGENT_SPAN_TYPES.md) - Complete span types and attributes
- [Instrumentation Patterns](./CLAUDE_AGENT_PATTERNS.md) - Advanced patterns and best practices
- [Troubleshooting Guide](./CLAUDE_AGENT_TROUBLESHOOTING.md) - Common issues and solutions
- [Credential Management](./CLAUDE_AGENT_CREDENTIALS.md) - Security and secret management

## Configuration Options

### Full Configuration

```typescript
await setupObservability({
  // Required
  apiKey: process.env.LANGWATCH_API_KEY,
  serviceName: "my-agent",
  
  // Optional
  endpoint: "https://app.langwatch.ai/api/otel/v1/traces",
  samplingRate: 1.0, // 0.0 to 1.0
  captureInput: true,
  captureOutput: true,
  
  // Custom metadata
  customMetadata: {
    environment: "production",
    version: "1.0.0"
  }
});
```

### Environment Variables

```bash
# Required
LANGWATCH_API_KEY=lw_xxx

# Optional
LANGWATCH_ENDPOINT=https://app.langwatch.ai/api/otel/v1/traces
ANTHROPIC_API_KEY=sk-ant-xxx
```

## Manual Instrumentation

For more control, use the tracer API directly:

```typescript
import { getLangWatchTracer } from "langwatch";

const tracer = getLangWatchTracer("my-agent");

await tracer.withActiveSpan("custom-operation", async (span) => {
  span.setType("agent_skill");
  span.setInput("Operation input");
  
  try {
    // Your operation logic
    const result = await performOperation();
    span.setOutput(result);
  } catch (error) {
    // Errors are automatically captured
    throw error;
  }
});
```

## Support

- [LangWatch Documentation](https://docs.langwatch.ai)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [GitHub Issues](https://github.com/langwatch/langwatch/issues)
