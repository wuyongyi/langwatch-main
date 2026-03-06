# Claude Code Agent Examples

This directory contains complete, runnable examples demonstrating how to instrument Claude Code agents with LangWatch for comprehensive observability, evaluation, and testing.

## Prerequisites

- Node.js 18+ or TypeScript runtime (tsx)
- LangWatch API key ([get one here](https://app.langwatch.ai))
- Anthropic API key for Claude API access

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Create a `.env` file in this directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```bash
LANGWATCH_API_KEY=lw_xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional: Point to local LangWatch instance
LANGWATCH_ENDPOINT=http://localhost:5560
```

## Examples

### 1. Basic Agent with SDK Instrumentation

**File:** `src/basic-agent.ts`

A simple Q&A agent demonstrating core instrumentation patterns:

- ✅ `@trace` decorator for agent entry points
- ✅ `@span` decorator for skill instrumentation  
- ✅ Automatic Claude API call instrumentation
- ✅ Input/output capture
- ✅ Metadata attachment

**Run:**

```bash
npm run basic
```

**What you'll see:**
- Agent answering questions using Claude
- Automatic trace creation for each execution
- Nested spans for context retrieval and answer generation
- LLM spans with token usage and costs

**View in LangWatch:**
- Navigate to Traces page
- See complete execution tree with timing
- Inspect LLM calls, tokens, and costs
- Analyze performance metrics

---

### 2. Code Generation Agent with Evaluation

**File:** `src/code-generation-agent.ts`

A code generation agent with quality evaluation:

- ✅ Multi-step code generation workflow
- ✅ Code correctness evaluator
- ✅ Scenario-based testing
- ✅ Quality metrics tracking

**Run:**

```bash
npm run code-gen
```

**What you'll see:**
- Agent generating Python code from natural language
- Multi-step process: requirements → synthesis → validation
- Automatic evaluation of generated code
- Scenario test results with pass/fail status

**Key Features:**
- **Requirement Parsing**: Extracts key requirements from prompts
- **Code Synthesis**: Generates code using Claude
- **Syntax Validation**: Checks for basic syntax errors
- **Error Fixing**: Attempts to fix syntax issues
- **Scenario Testing**: Runs multiple test scenarios
- **Quality Evaluation**: Scores code correctness

**View in LangWatch:**
- See code generation traces with evaluations
- Analyze code quality metrics
- Review scenario test results
- Track success rates over time

---

### 3. MCP Integration Example

**File:** `src/mcp-integration.ts`

Advanced patterns using MCP tools for agent self-instrumentation:

- ✅ Self-monitoring agent (checks own performance)
- ✅ Adaptive agent (learns from history)
- ✅ Learning agent (retrieves successful examples)
- ✅ MCP tool usage patterns

**Run:**

```bash
npm run mcp
```

**What you'll see:**
- **Self-Monitoring Agent**: Queries recent traces to check error rates and costs
- **Adaptive Agent**: Analyzes historical performance to select best strategy
- **Learning Agent**: Retrieves successful examples to inform new executions

**MCP Tools Demonstrated:**
- `search_traces`: Find traces with filters
- `get_trace`: Retrieve complete trace details
- `get_analytics`: Query performance metrics

**Note:** This example simulates MCP tool calls. In a real Claude Code agent, these would be actual MCP tool invocations through the agent's tool-calling capabilities.

**View in LangWatch:**
- See how agents query their own traces
- Observe adaptive behavior based on analytics
- Track learning from successful examples

---

## What Gets Captured

All examples automatically capture:

| Data | Description |
|------|-------------|
| **Traces** | Complete agent execution from input to output |
| **Spans** | Individual operations (skills, API calls, tools) |
| **LLM Calls** | Model, tokens, cost, latency, input/output |
| **Errors** | Exceptions with stack traces |
| **Metadata** | Timestamps, duration, custom fields |
| **Evaluations** | Quality scores and pass/fail results |

## Project Structure

```
claude-agents/
├── src/
│   ├── basic-agent.ts              # Simple Q&A agent
│   ├── code-generation-agent.ts    # Code gen with evaluation
│   └── mcp-integration.ts          # MCP tool patterns
├── package.json                     # Dependencies and scripts
├── .env.example                     # Environment template
└── README.md                        # This file
```

## Key Concepts

### Decorators

**@trace**: Creates a root trace for agent execution

```typescript
@trace({ name: "agent-execution" })
async handleRequest(input: string): Promise<string> {
  // Agent logic
}
```

**@span**: Creates a nested span for skills

```typescript
@span({ type: "agent_skill", name: "code-generation" })
async generateCode(prompt: string): Promise<string> {
  // Skill logic
}
```

### Auto-Instrumentation

Automatically track Claude API calls:

```typescript
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";

const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// All API calls now create LLM spans automatically
const response = await client.messages.create({...});
```

### Evaluation

Evaluate agent outputs for quality:

```typescript
function evaluateCodeCorrectness(code: string): {
  passed: boolean;
  score: number;
  details: string;
} {
  // Evaluation logic
  return { passed: true, score: 0.95, details: "Code is correct" };
}
```

### Scenario Testing

Run multiple test scenarios:

```typescript
const scenarios = [
  {
    name: "Generate sorting function",
    prompt: "Create a Python function that sorts a list",
    criteria: ["Function accepts list", "Returns sorted list"]
  }
];

for (const scenario of scenarios) {
  const result = await agent.execute(scenario.prompt);
  const evaluation = evaluate(result, scenario.criteria);
  // Track results
}
```

## Viewing Results

After running examples, view your data in [LangWatch Dashboard](https://app.langwatch.ai):

1. **Traces Page**
   - See all agent executions
   - Filter by status, time, metadata
   - Click to see execution tree

2. **Trace Details**
   - Complete span hierarchy
   - Input/output for each operation
   - LLM calls with tokens and costs
   - Error details if any

3. **Analytics**
   - Token usage trends
   - Cost analysis
   - Error rates
   - Latency percentiles

4. **Evaluations**
   - Quality scores
   - Pass/fail rates
   - Scenario test results

## Troubleshooting

### Traces Not Appearing

1. Check API key is set: `echo $LANGWATCH_API_KEY`
2. Verify endpoint is correct (default: `https://app.langwatch.ai`)
3. Wait 5-10 seconds for traces to export
4. Check console for export errors

### Authentication Errors

1. Verify API key is valid
2. Check key has required permissions
3. Ensure key is not expired

### Claude API Errors

1. Verify `ANTHROPIC_API_KEY` is set
2. Check API key is valid
3. Ensure you have API credits

### Import Errors

1. Run `npm install` to install dependencies
2. Check Node.js version (18+ required)
3. Verify TypeScript is configured correctly

## Next Steps

- **[Quickstart Guide](../../docs/CLAUDE_AGENT_QUICKSTART.md)** - SDK instrumentation basics
- **[MCP Integration Guide](../../docs/CLAUDE_AGENT_MCP.md)** - MCP tools and patterns
- **[Span Types Reference](../../docs/CLAUDE_AGENT_SPAN_TYPES.md)** - Complete span types
- **[Instrumentation Patterns](../../docs/CLAUDE_AGENT_PATTERNS.md)** - Advanced patterns
- **[Troubleshooting Guide](../../docs/CLAUDE_AGENT_TROUBLESHOOTING.md)** - Common issues

## Support

- **Documentation**: [docs.langwatch.ai](https://docs.langwatch.ai)
- **Discord**: [Join our community](https://discord.gg/kT4PhDS2gH)
- **GitHub**: [Report issues](https://github.com/langwatch/langwatch/issues)

## License

MIT - See LICENSE file for details
