# Claude Code Agent Integration - Instrumentation Patterns

This guide provides common patterns and best practices for instrumenting Claude Code agents with LangWatch.

## Table of Contents

- [Basic Patterns](#basic-patterns)
- [Nested Span Patterns](#nested-span-patterns)
- [Error Handling Patterns](#error-handling-patterns)
- [Metadata Patterns](#metadata-patterns)
- [Advanced Patterns](#advanced-patterns)

## Basic Patterns

### Pattern 1: Simple Agent with Decorators

The simplest way to instrument an agent using decorators:

```typescript
import { trace, span } from "langwatch/observability";
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";

const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

class SimpleAgent {
  @trace({ name: "simple-agent" })
  async execute(userInput: string): Promise<string> {
    const response = await this.processInput(userInput);
    return response;
  }

  @span({ type: "agent_skill", name: "process-input" })
  async processInput(input: string): Promise<string> {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: input }]
    });
    
    return response.content[0].type === "text" 
      ? response.content[0].text 
      : "";
  }
}
```

**When to use**: Simple agents with straightforward execution flow.

### Pattern 2: Manual Instrumentation

For more control, use the tracer API directly:

```typescript
import { getLangWatchTracer } from "langwatch";

class ManualAgent {
  private tracer = getLangWatchTracer("manual-agent");

  async execute(userInput: string): Promise<string> {
    return await this.tracer.withActiveSpan("agent-execution", async (span) => {
      span.setType("agent");
      span.setInput(userInput);
      span.setAttribute("langwatch.task.type", "qa");
      
      try {
        const response = await this.processInput(userInput);
        span.setOutput(response);
        return response;
      } catch (error) {
        // Error is automatically captured
        throw error;
      }
    });
  }

  async processInput(input: string): Promise<string> {
    return await this.tracer.withActiveSpan("process-input", async (span) => {
      span.setType("agent_skill");
      span.setInput(input);
      
      const response = await this.callLLM(input);
      span.setOutput(response);
      
      return response;
    });
  }
}
```

**When to use**: When you need fine-grained control over span attributes and timing.

## Nested Span Patterns

### Pattern 3: Multi-Step Workflow

Create properly nested spans for complex workflows:

```typescript
class WorkflowAgent {
  @trace({ name: "workflow-agent" })
  async execute(task: string): Promise<string> {
    // Step 1: Understand the task
    const understanding = await this.understandTask(task);
    
    // Step 2: Plan the approach
    const plan = await this.planApproach(understanding);
    
    // Step 3: Execute the plan
    const result = await this.executePlan(plan);
    
    // Step 4: Validate the result
    const validated = await this.validateResult(result);
    
    return validated;
  }

  @span({ type: "agent_skill", name: "understand-task" })
  async understandTask(task: string): Promise<any> {
    // Task understanding logic
    return understanding;
  }

  @span({ type: "agent_skill", name: "plan-approach" })
  async planApproach(understanding: any): Promise<any> {
    // Planning logic
    return plan;
  }

  @span({ type: "chain", name: "execute-plan" })
  async executePlan(plan: any): Promise<string> {
    // Each step creates its own span
    const step1 = await this.executeStep1(plan);
    const step2 = await this.executeStep2(step1);
    const step3 = await this.executeStep3(step2);
    return step3;
  }

  @span({ type: "agent_skill", name: "execute-step-1" })
  async executeStep1(plan: any): Promise<any> { ... }

  @span({ type: "agent_skill", name: "execute-step-2" })
  async executeStep2(input: any): Promise<any> { ... }

  @span({ type: "agent_skill", name: "execute-step-3" })
  async executeStep3(input: any): Promise<string> { ... }

  @span({ type: "tool", name: "validate-result" })
  async validateResult(result: string): Promise<string> {
    // Validation logic
    return result;
  }
}
```

**When to use**: Complex agents with multiple sequential steps.

### Pattern 4: RAG Agent with Context Retrieval

Instrument RAG workflows with proper context tracking:

```typescript
class RAGAgent {
  @trace({ name: "rag-agent" })
  async answerQuestion(question: string): Promise<string> {
    // Retrieve relevant context
    const contexts = await this.retrieveContext(question);
    
    // Generate answer with context
    const answer = await this.generateAnswer(question, contexts);
    
    return answer;
  }

  @span({ type: "retriever", name: "context-retrieval" })
  async retrieveContext(question: string): Promise<any[]> {
    const tracer = getLangWatchTracer("rag-agent");
    const span = tracer.getActiveSpan();
    
    // Perform vector search
    const results = await this.vectorDB.search(question, 5);
    
    // Attach RAG contexts to span
    if (span) {
      span.setRAGContexts(results.map(r => ({
        document_id: r.documentId,
        chunk_id: r.chunkId,
        content: r.content,
        score: r.score
      })));
    }
    
    return results;
  }

  @span({ type: "agent_skill", name: "answer-generation" })
  async generateAnswer(question: string, contexts: any[]): Promise<string> {
    const prompt = this.buildPrompt(question, contexts);
    
    // LLM call is automatically instrumented
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    
    return response.content[0].type === "text" 
      ? response.content[0].text 
      : "";
  }

  private buildPrompt(question: string, contexts: any[]): string {
    const contextText = contexts.map(c => c.content).join("\n\n");
    return `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;
  }
}
```

**When to use**: RAG agents that retrieve and use context for generation.

## Error Handling Patterns

### Pattern 5: Graceful Error Handling

Handle errors gracefully while capturing them in traces:

```typescript
class ResilientAgent {
  @trace({ name: "resilient-agent" })
  async execute(task: string): Promise<string> {
    try {
      return await this.attemptExecution(task);
    } catch (error) {
      // Error is captured in trace
      console.error("Execution failed:", error);
      
      // Try fallback approach
      return await this.fallbackExecution(task);
    }
  }

  @span({ type: "agent_skill", name: "primary-execution" })
  async attemptExecution(task: string): Promise<string> {
    // Primary execution logic that might fail
    return await this.riskyOperation(task);
  }

  @span({ type: "agent_skill", name: "fallback-execution" })
  async fallbackExecution(task: string): Promise<string> {
    // Simpler fallback logic
    return await this.safeOperation(task);
  }
}
```

**When to use**: Agents that need fallback strategies for error recovery.

### Pattern 6: Retry with Exponential Backoff

Implement retry logic with proper span tracking:

```typescript
class RetryAgent {
  @span({ type: "agent_skill", name: "operation-with-retry" })
  async executeWithRetry(
    operation: () => Promise<string>,
    maxRetries: number = 3
  ): Promise<string> {
    const tracer = getLangWatchTracer("retry-agent");
    const span = tracer.getActiveSpan();
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        span?.setAttribute("retry.attempt", attempt);
        const result = await operation();
        span?.setAttribute("retry.succeeded", true);
        return result;
      } catch (error) {
        lastError = error as Error;
        span?.setAttribute(`retry.attempt_${attempt}.error`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    span?.setAttribute("retry.succeeded", false);
    span?.setAttribute("retry.total_attempts", maxRetries);
    throw lastError!;
  }
}
```

**When to use**: Operations that may fail transiently and benefit from retries.

## Metadata Patterns

### Pattern 7: User Context Tracking

Track user context across agent executions:

```typescript
class UserContextAgent {
  @trace({ name: "user-context-agent" })
  async execute(
    userInput: string,
    userId: string,
    threadId: string
  ): Promise<string> {
    const tracer = getLangWatchTracer("user-context-agent");
    const span = tracer.getActiveSpan();
    
    // Attach user context
    if (span) {
      span.setAttribute("langwatch.user.id", userId);
      span.setAttribute("langwatch.thread.id", threadId);
      span.setAttribute("langwatch.task.type", "conversation");
    }
    
    // Execute with context
    return await this.processWithContext(userInput, userId);
  }

  @span({ type: "agent_skill", name: "context-aware-processing" })
  async processWithContext(input: string, userId: string): Promise<string> {
    // Retrieve user history
    const history = await this.getUserHistory(userId);
    
    // Process with history context
    return await this.generateResponse(input, history);
  }
}
```

**When to use**: Multi-user agents that need to track user-specific context.

### Pattern 8: Risk Classification

Classify operations by risk level:

```typescript
class RiskAwareAgent {
  @trace({ name: "risk-aware-agent" })
  async execute(operation: string, params: any): Promise<string> {
    const tracer = getLangWatchTracer("risk-aware-agent");
    const span = tracer.getActiveSpan();
    
    // Classify risk
    const riskLevel = this.classifyRisk(operation, params);
    
    if (span) {
      span.setAttribute("langwatch.risk.level", riskLevel);
      span.setAttribute("langwatch.risk.reason", this.getRiskReason(operation));
    }
    
    // Execute with appropriate safeguards
    if (riskLevel === "high") {
      return await this.executeWithExtraValidation(operation, params);
    } else {
      return await this.executeNormally(operation, params);
    }
  }

  private classifyRisk(operation: string, params: any): "low" | "medium" | "high" {
    if (operation.includes("delete") || operation.includes("drop")) {
      return "high";
    }
    if (operation.includes("update") || operation.includes("modify")) {
      return "medium";
    }
    return "low";
  }

  private getRiskReason(operation: string): string {
    if (operation.includes("delete")) return "Destructive operation";
    if (operation.includes("update")) return "Data modification";
    return "Read-only operation";
  }
}
```

**When to use**: Agents performing operations with varying risk levels.

## Advanced Patterns

### Pattern 9: Parallel Execution

Track parallel operations with proper span relationships:

```typescript
class ParallelAgent {
  @trace({ name: "parallel-agent" })
  async execute(tasks: string[]): Promise<string[]> {
    // Execute tasks in parallel, each with its own span
    const results = await Promise.all(
      tasks.map((task, index) => this.executeTask(task, index))
    );
    
    return results;
  }

  @span({ type: "agent_skill", name: "parallel-task" })
  async executeTask(task: string, index: number): Promise<string> {
    const tracer = getLangWatchTracer("parallel-agent");
    const span = tracer.getActiveSpan();
    
    span?.setAttribute("task.index", index);
    span?.setAttribute("task.id", `task-${index}`);
    
    // Execute task
    const result = await this.processTask(task);
    return result;
  }
}
```

**When to use**: Agents that execute multiple operations concurrently.

### Pattern 10: Conditional Instrumentation

Conditionally enable instrumentation based on configuration:

```typescript
class ConditionalAgent {
  private shouldTrace: boolean;

  constructor(config: { enableTracing: boolean }) {
    this.shouldTrace = config.enableTracing;
  }

  async execute(task: string): Promise<string> {
    if (this.shouldTrace) {
      return await this.executeWithTracing(task);
    } else {
      return await this.executeWithoutTracing(task);
    }
  }

  @trace({ name: "traced-execution" })
  async executeWithTracing(task: string): Promise<string> {
    return await this.processTask(task);
  }

  async executeWithoutTracing(task: string): Promise<string> {
    return await this.processTask(task);
  }

  private async processTask(task: string): Promise<string> {
    // Shared processing logic
    return result;
  }
}
```

**When to use**: When you need to toggle instrumentation for testing or performance.

### Pattern 11: Custom Metrics Tracking

Track custom metrics alongside traces:

```typescript
class MetricsAgent {
  @span({ type: "agent_skill", name: "operation-with-metrics" })
  async executeWithMetrics(input: string): Promise<string> {
    const tracer = getLangWatchTracer("metrics-agent");
    const span = tracer.getActiveSpan();
    
    const startTime = Date.now();
    
    // Execute operation
    const result = await this.performOperation(input);
    
    const duration = Date.now() - startTime;
    
    // Record custom metrics
    if (span) {
      span.setMetrics({
        completionTimeMs: duration,
        inputLength: input.length,
        outputLength: result.length,
        processingRate: result.length / (duration / 1000) // chars per second
      });
      
      span.setAttribute("custom.complexity", this.calculateComplexity(input));
      span.setAttribute("custom.quality_score", this.assessQuality(result));
    }
    
    return result;
  }

  private calculateComplexity(input: string): number {
    // Custom complexity calculation
    return input.split(" ").length;
  }

  private assessQuality(output: string): number {
    // Custom quality assessment
    return 0.95;
  }
}
```

**When to use**: When you need to track custom performance or quality metrics.

### Pattern 12: Evaluation Integration

Integrate evaluations directly into agent execution:

```typescript
import { registerEvaluator } from "langwatch/observability/evaluation";

// Register custom evaluator
registerEvaluator({
  name: "code-quality",
  evaluate: async (input: string, output: string) => {
    const hasDocstring = output.includes('"""') || output.includes("'''");
    const hasTypeHints = output.includes(":") && output.includes("->");
    const score = (hasDocstring ? 0.5 : 0) + (hasTypeHints ? 0.5 : 0);
    
    return {
      passed: score >= 0.5,
      score,
      details: `Docstring: ${hasDocstring}, Type hints: ${hasTypeHints}`
    };
  }
});

class EvaluatedAgent {
  @trace({ name: "evaluated-agent" })
  async generateCode(prompt: string): Promise<string> {
    const code = await this.generate(prompt);
    
    // Evaluation runs automatically on trace completion
    return code;
  }

  @span({ type: "agent_skill", name: "code-generation" })
  async generate(prompt: string): Promise<string> {
    const tracer = getLangWatchTracer("evaluated-agent");
    const span = tracer.getActiveSpan();
    
    const code = await this.callLLM(prompt);
    
    // Optionally record evaluation directly on span
    if (span) {
      const evaluation = await this.evaluateCode(code);
      span.recordEvaluation({
        name: "code-quality",
        passed: evaluation.passed,
        score: evaluation.score,
        details: evaluation.details
      });
    }
    
    return code;
  }
}
```

**When to use**: Agents that need immediate quality assessment of outputs.

## Best Practices Summary

### Do's ✅

1. **Use decorators for simple cases**: `@trace` and `@span` for straightforward instrumentation
2. **Use manual instrumentation for control**: `withActiveSpan` when you need fine-grained control
3. **Nest spans properly**: Create hierarchies that reflect actual execution flow
4. **Capture meaningful input/output**: Include enough context for debugging
5. **Add metadata for filtering**: Use `langwatch.*` attributes for better trace organization
6. **Let errors propagate**: Errors are automatically captured, just re-throw them
7. **Use auto-instrumentation**: Leverage `instrumentClaudeClient` for LLM calls

### Don'ts ❌

1. **Don't create flat span structures**: Avoid all spans at the same level
2. **Don't capture sensitive data**: Use redaction for PII and secrets
3. **Don't ignore errors**: Let instrumentation capture them automatically
4. **Don't over-instrument**: Focus on meaningful operations, not every function
5. **Don't forget to end spans**: Use `withActiveSpan` or decorators to ensure proper cleanup
6. **Don't mix instrumentation styles**: Choose decorators OR manual, not both in the same class
7. **Don't create spans for trivial operations**: Instrument significant operations only

## Next Steps

- [Quickstart Guide](./CLAUDE_AGENT_QUICKSTART.md) - Get started with basic instrumentation
- [Span Types Reference](./CLAUDE_AGENT_SPAN_TYPES.md) - Complete span types documentation
- [Troubleshooting Guide](./CLAUDE_AGENT_TROUBLESHOOTING.md) - Common issues and solutions
- [MCP Integration](./CLAUDE_AGENT_MCP.md) - Use MCP tools for agent self-instrumentation

## Support

- [LangWatch Documentation](https://docs.langwatch.ai)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [GitHub Issues](https://github.com/langwatch/langwatch/issues)
