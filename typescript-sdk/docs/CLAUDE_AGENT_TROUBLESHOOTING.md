# Claude Code Agent Integration - Troubleshooting Guide

This guide helps you diagnose and resolve common issues when integrating Claude Code agents with LangWatch.

## Table of Contents

- [Traces Not Appearing](#traces-not-appearing)
- [Missing Spans](#missing-spans)
- [Authentication Errors](#authentication-errors)
- [Performance Issues](#performance-issues)
- [Data Capture Issues](#data-capture-issues)
- [Decorator Issues](#decorator-issues)
- [MCP Integration Issues](#mcp-integration-issues)

## Traces Not Appearing

### Issue: No traces appear in LangWatch dashboard

**Symptoms:**
- Agent executes successfully
- No traces visible in LangWatch dashboard
- No errors in console

**Possible Causes & Solutions:**

#### 1. API Key Not Set

**Check:**
```typescript
console.log("API Key set:", !!process.env.LANGWATCH_API_KEY);
```

**Solution:**
```bash
# Set environment variable
export LANGWATCH_API_KEY=lw_your_api_key_here

# Or in .env file
LANGWATCH_API_KEY=lw_your_api_key_here
```

#### 2. setupObservability Not Called

**Check:**
```typescript
// Ensure this is called before any agent execution
await setupObservability({
  serviceName: "my-agent"
});
```

**Solution:**
```typescript
// Call at application startup
import { setupObservability } from "langwatch/observability/node";

async function main() {
  // Initialize first
  await setupObservability({
    serviceName: "my-agent"
  });
  
  // Then run agent
  const agent = new MyAgent();
  await agent.execute("task");
}

main();
```

#### 3. Spans Not Exported Before Process Exit

**Check:**
If your script exits immediately after execution, spans may not be exported.

**Solution:**
```typescript
import { setupObservability } from "langwatch/observability/node";

async function main() {
  await setupObservability({ serviceName: "my-agent" });
  
  const agent = new MyAgent();
  await agent.execute("task");
  
  // Wait for spans to export
  await new Promise(resolve => setTimeout(resolve, 2000));
}

main();
```

Or use graceful shutdown:

```typescript
import { trace } from "@opentelemetry/api";

process.on("SIGTERM", async () => {
  // Flush remaining spans
  await trace.getTracerProvider()?.shutdown();
  process.exit(0);
});
```

#### 4. Network/Firewall Issues

**Check:**
```typescript
// Test connectivity
const response = await fetch("https://app.langwatch.ai/api/health");
console.log("LangWatch reachable:", response.ok);
```

**Solution:**
- Check firewall rules
- Verify proxy settings
- Ensure HTTPS traffic is allowed

#### 5. Wrong Endpoint

**Check:**
```typescript
// Verify endpoint configuration
await setupObservability({
  serviceName: "my-agent",
  endpoint: "https://app.langwatch.ai/api/otel/v1/traces" // Default
});
```

**Solution:**
Use the correct endpoint for your deployment:
- Cloud: `https://app.langwatch.ai/api/otel/v1/traces`
- Self-hosted: `https://your-domain.com/api/otel/v1/traces`

## Missing Spans

### Issue: Some spans don't appear in traces

**Symptoms:**
- Root trace appears
- Some child spans are missing
- Incomplete execution tree

**Possible Causes & Solutions:**

#### 1. Async Context Lost

**Problem:**
```typescript
// ❌ Context lost in setTimeout
@span({ type: "agent_skill", name: "delayed-operation" })
async delayedOperation() {
  setTimeout(() => {
    // This span won't be nested properly
    this.doWork();
  }, 1000);
}
```

**Solution:**
```typescript
// ✅ Use async/await to preserve context
@span({ type: "agent_skill", name: "delayed-operation" })
async delayedOperation() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  await this.doWork(); // Context preserved
}
```

#### 2. Spans Not Ended

**Problem:**
```typescript
// ❌ Manual span not ended
const span = tracer.startSpan("operation");
await doWork();
// Forgot to call span.end()
```

**Solution:**
```typescript
// ✅ Use withActiveSpan for automatic cleanup
await tracer.withActiveSpan("operation", async (span) => {
  await doWork();
  // Span automatically ended
});
```

#### 3. Decorator on Non-Async Method

**Problem:**
```typescript
// ❌ Decorator on sync method
@span({ type: "agent_skill", name: "sync-operation" })
syncOperation() {
  return "result";
}
```

**Solution:**
```typescript
// ✅ Make method async
@span({ type: "agent_skill", name: "async-operation" })
async asyncOperation() {
  return "result";
}
```

#### 4. Parallel Execution Without Proper Context

**Problem:**
```typescript
// ❌ Context not propagated to parallel operations
const results = await Promise.all([
  this.operation1(),
  this.operation2(),
  this.operation3()
]);
```

**Solution:**
Ensure each operation is properly instrumented:

```typescript
// ✅ Each operation creates its own span
@span({ type: "agent_skill", name: "operation-1" })
async operation1() { ... }

@span({ type: "agent_skill", name: "operation-2" })
async operation2() { ... }

@span({ type: "agent_skill", name: "operation-3" })
async operation3() { ... }
```

## Authentication Errors

### Issue: 401 Unauthorized or 403 Forbidden errors

**Symptoms:**
- Console shows authentication errors
- Traces not appearing
- Error messages about invalid API key

**Solutions:**

#### 1. Verify API Key Format

```typescript
// Check API key format
const apiKey = process.env.LANGWATCH_API_KEY;
console.log("API Key starts with 'lw_':", apiKey?.startsWith("lw_"));
console.log("API Key length:", apiKey?.length);
```

API keys should:
- Start with `lw_`
- Be approximately 40-50 characters long

#### 2. Check API Key Permissions

Ensure your API key has the required permissions:
- Navigate to LangWatch Dashboard → Settings → API Keys
- Verify the key has "Write Traces" permission
- Regenerate key if necessary

#### 3. Verify Project ID

```typescript
// Ensure you're using the correct project
await setupObservability({
  serviceName: "my-agent",
  apiKey: process.env.LANGWATCH_API_KEY,
  // Project ID is derived from API key
});
```

## Performance Issues

### Issue: Agent execution is slow after adding instrumentation

**Symptoms:**
- Noticeable latency increase
- Slow response times
- High CPU usage

**Solutions:**

#### 1. Reduce Sampling Rate

```typescript
// Sample only 10% of traces
await setupObservability({
  serviceName: "my-agent",
  samplingRate: 0.1 // 0.0 to 1.0
});
```

#### 2. Disable Input/Output Capture for Large Payloads

```typescript
await setupObservability({
  serviceName: "my-agent",
  captureInput: false,  // Disable for large inputs
  captureOutput: false  // Disable for large outputs
});
```

#### 3. Reduce Span Granularity

```typescript
// ❌ Too many spans
@span({ type: "agent_skill", name: "process-item" })
async processItem(item: any) {
  await this.validateItem(item);  // Creates span
  await this.transformItem(item); // Creates span
  await this.saveItem(item);      // Creates span
}

// ✅ Appropriate granularity
@span({ type: "agent_skill", name: "process-item" })
async processItem(item: any) {
  await this.validateItem(item);  // No span
  await this.transformItem(item); // No span
  await this.saveItem(item);      // No span
}
```

#### 4. Use Batch Export Settings

```typescript
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

// Adjust batch settings for your workload
const processor = new BatchSpanProcessor(exporter, {
  maxQueueSize: 2048,
  maxExportBatchSize: 512,
  scheduledDelayMillis: 5000 // Export every 5 seconds
});
```

## Data Capture Issues

### Issue: Input/output not captured correctly

**Symptoms:**
- Empty input/output in traces
- Truncated data
- Wrong data format

**Solutions:**

#### 1. Ensure Data is Set Before Span Ends

```typescript
// ❌ Data set after span ends
@span({ type: "agent_skill", name: "operation" })
async operation(input: string): Promise<string> {
  const result = await doWork(input);
  return result;
  // Input/output not explicitly set
}

// ✅ Explicitly set input/output
await tracer.withActiveSpan("operation", async (span) => {
  span.setInput(input);
  const result = await doWork(input);
  span.setOutput(result);
  return result;
});
```

#### 2. Handle Large Payloads

```typescript
// For large payloads, capture summary instead
await tracer.withActiveSpan("large-operation", async (span) => {
  const largeInput = getLargeData();
  
  // Capture summary instead of full data
  span.setInput({
    type: "large_dataset",
    size: largeInput.length,
    sample: largeInput.slice(0, 100)
  });
  
  const result = await process(largeInput);
  
  span.setOutput({
    type: "processed_dataset",
    size: result.length,
    sample: result.slice(0, 100)
  });
});
```

#### 3. Handle Non-Serializable Data

```typescript
// ❌ Non-serializable data
span.setInput(new Date()); // May not serialize correctly

// ✅ Convert to serializable format
span.setInput({
  timestamp: new Date().toISOString(),
  data: serializableData
});
```

## Decorator Issues

### Issue: Decorators not working

**Symptoms:**
- No spans created when using `@trace` or `@span`
- TypeScript compilation errors
- Runtime errors about decorators

**Solutions:**

#### 1. Enable Experimental Decorators

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

#### 2. Ensure Method is Async

```typescript
// ❌ Decorator on sync method
@span({ type: "agent_skill", name: "sync-method" })
syncMethod() {
  return "result";
}

// ✅ Decorator on async method
@span({ type: "agent_skill", name: "async-method" })
async asyncMethod() {
  return "result";
}
```

#### 3. Check Decorator Import

```typescript
// ✅ Correct import
import { trace, span } from "langwatch/observability";

// ❌ Wrong import
import { trace, span } from "langwatch"; // Wrong path
```

#### 4. Verify setupObservability Called

```typescript
// Decorators require setupObservability to be called first
await setupObservability({ serviceName: "my-agent" });

// Then use decorators
const agent = new MyAgent();
await agent.execute();
```

## MCP Integration Issues

### Issue: MCP tools not working

**Symptoms:**
- MCP server not found
- Authentication errors
- Empty results from MCP tools

**Solutions:**

#### 1. Verify MCP Server Configuration

**Check configuration file:**
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

#### 2. Test MCP Server Manually

```bash
# Test MCP server installation
npx -y @langwatch/mcp-server --apiKey your-api-key-here

# Should start without errors
```

#### 3. Check MCP Server Logs

Enable debug logging:
```json
{
  "mcpServers": {
    "langwatch": {
      "command": "npx",
      "args": ["-y", "@langwatch/mcp-server", "--debug"],
      "env": {
        "LANGWATCH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### 4. Verify API Key in MCP Config

Ensure the API key in MCP configuration matches your LangWatch API key:
```bash
# Check API key
echo $LANGWATCH_API_KEY

# Should match the key in MCP config
```

## Common Error Messages

### "Failed to export spans"

**Cause:** Network issue or invalid endpoint

**Solution:**
1. Check network connectivity
2. Verify endpoint URL
3. Check firewall rules

### "Invalid API key"

**Cause:** Wrong or expired API key

**Solution:**
1. Verify API key format (starts with `lw_`)
2. Regenerate API key in dashboard
3. Update environment variable

### "Span context not found"

**Cause:** Async context lost

**Solution:**
1. Use `withActiveSpan` instead of manual span management
2. Ensure async/await is used correctly
3. Avoid setTimeout/setInterval without proper context propagation

### "Maximum call stack size exceeded"

**Cause:** Circular reference in span data

**Solution:**
1. Avoid capturing objects with circular references
2. Serialize data before setting as input/output
3. Use JSON.stringify with replacer function

## Debugging Tips

### Enable Debug Logging

```typescript
import { setupObservability } from "langwatch/observability/node";

await setupObservability({
  serviceName: "my-agent",
  // Enable debug logging
  logLevel: "debug"
});
```

### Inspect Spans Locally

```typescript
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";

// Use in-memory exporter for debugging
const memoryExporter = new InMemorySpanExporter();

// After execution, inspect spans
const spans = memoryExporter.getFinishedSpans();
console.log("Captured spans:", spans.length);
spans.forEach(span => {
  console.log("Span:", span.name, span.attributes);
});
```

### Verify Span Hierarchy

```typescript
// Log span relationships
const spans = memoryExporter.getFinishedSpans();
spans.forEach(span => {
  console.log(
    `Span: ${span.name}`,
    `Parent: ${span.parentSpanId || "root"}`,
    `Trace: ${span.spanContext().traceId}`
  );
});
```

### Test with Simple Example

```typescript
// Minimal test case
import { setupObservability } from "langwatch/observability/node";
import { getLangWatchTracer } from "langwatch";

async function test() {
  await setupObservability({ serviceName: "test" });
  
  const tracer = getLangWatchTracer("test");
  await tracer.withActiveSpan("test-span", async (span) => {
    span.setType("agent");
    span.setInput("test input");
    span.setOutput("test output");
  });
  
  // Wait for export
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log("Test complete - check dashboard");
}

test();
```

## Getting Help

If you're still experiencing issues:

1. **Check Documentation**: [docs.langwatch.ai](https://docs.langwatch.ai)
2. **Search GitHub Issues**: [github.com/langwatch/langwatch/issues](https://github.com/langwatch/langwatch/issues)
3. **Ask on Discord**: [discord.gg/kT4PhDS2gH](https://discord.gg/kT4PhDS2gH)
4. **Contact Support**: support@langwatch.ai

When reporting issues, include:
- LangWatch SDK version
- Node.js version
- Minimal reproduction code
- Error messages and stack traces
- Expected vs actual behavior

## FAQ

### Q: How long does it take for traces to appear?

**A:** Traces typically appear within 5-10 seconds. If using batch export, it may take up to the configured delay (default: 5 seconds).

### Q: Can I use LangWatch with other OpenTelemetry instrumentation?

**A:** Yes! LangWatch integrates with existing OpenTelemetry setups. Use `setupObservability` which will detect and reuse existing TracerProviders.

### Q: How much overhead does instrumentation add?

**A:** Typically less than 5% for most workloads. Use sampling to reduce overhead for high-volume applications.

### Q: Can I instrument agents in production?

**A:** Yes! Use sampling rates and disable input/output capture for sensitive data. Always follow your security policies.

### Q: Do I need to instrument every function?

**A:** No! Focus on significant operations: agent entry points, skills, LLM calls, and external tool usage.

## Next Steps

- [Quickstart Guide](./CLAUDE_AGENT_QUICKSTART.md) - Get started with instrumentation
- [Instrumentation Patterns](./CLAUDE_AGENT_PATTERNS.md) - Best practices and patterns
- [Span Types Reference](./CLAUDE_AGENT_SPAN_TYPES.md) - Complete span types documentation

## Support

- [LangWatch Documentation](https://docs.langwatch.ai)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [GitHub Issues](https://github.com/langwatch/langwatch/issues)
