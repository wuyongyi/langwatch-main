# Claude Code Agent Integration

This directory contains the implementation of the Claude Code Agent Integration feature, which adds comprehensive observability, evaluation, and testing capabilities for Claude Code agents.

## Directory Structure

```
observability-sdk/
├── decorators/                    # @trace and @span decorators
│   ├── __tests__/
│   │   ├── unit/                 # Unit tests for decorators
│   │   └── property/             # Property-based tests
│   └── index.ts
│
├── instrumentation/
│   ├── anthropic/                # Claude API auto-instrumentation
│   │   ├── __tests__/
│   │   │   ├── unit/            # Unit tests
│   │   │   ├── integration/     # Integration tests
│   │   │   └── property/        # Property-based tests
│   │   └── index.ts
│   └── langchain/                # Existing LangChain instrumentation
│
├── evaluation/                    # Evaluation framework
│   ├── __tests__/
│   │   ├── unit/                 # Unit tests for evaluators
│   │   └── property/             # Property-based tests
│   └── index.ts
│
├── scenarios/                     # Scenario-based testing
│   ├── __tests__/
│   │   ├── unit/                 # Unit tests
│   │   └── property/             # Property-based tests
│   └── index.ts
│
├── risk/                          # Risk assessment system
│   ├── __tests__/
│   │   ├── unit/                 # Unit tests
│   │   └── property/             # Property-based tests
│   └── index.ts
│
└── agent-instrumentation-types.ts # Shared type definitions
```

## Key Components

### 1. Decorators (`decorators/`)
- `@trace()` - Decorator for agent entry points, creates root traces
- `@span()` - Decorator for skills and operations, creates nested spans

### 2. Anthropic Instrumentation (`instrumentation/anthropic/`)
- Auto-instrumentation for Claude API client
- Captures model info, token usage, costs, and response content
- Automatic LLM span creation for all API calls

### 3. Evaluation Framework (`evaluation/`)
- Custom evaluator interface and registration
- Built-in evaluators:
  - Code correctness evaluator
  - Response accuracy evaluator
  - Task completion evaluator
- Automatic evaluation execution on trace completion

### 4. Scenario Testing (`scenarios/`)
- Scenario creation and management
- Scenario execution engine
- Batch testing capabilities
- Report generation

### 5. Risk Assessment (`risk/`)
- Risk level classification (low, medium, high)
- Automatic risk classification based on operation type
- Risk-based monitoring and alerting

## Dependencies

### Core Dependencies (already installed)
- `@opentelemetry/api` - OpenTelemetry API
- `@opentelemetry/sdk-trace-base` - Trace SDK
- `@opentelemetry/exporter-trace-otlp-http` - OTLP HTTP exporter

### Testing Dependencies
- `fast-check` - Property-based testing library
- `vitest` - Test runner

## Testing Strategy

This feature uses a dual testing approach:

1. **Unit Tests** (`__tests__/unit/`)
   - Test specific examples and edge cases
   - Test integration points
   - Test error conditions

2. **Property-Based Tests** (`__tests__/property/`)
   - Test universal correctness properties
   - Use fast-check with minimum 100 iterations
   - Validate behavior across all inputs

3. **Integration Tests** (`__tests__/integration/`)
   - Test complete flows end-to-end
   - Test with real LangWatch API (where applicable)

## Implementation Status

See `.kiro/specs/claude-code-agent-integration/tasks.md` for the complete implementation plan and current progress.

## References

- Requirements: `.kiro/specs/claude-code-agent-integration/requirements.md`
- Design: `.kiro/specs/claude-code-agent-integration/design.md`
- Tasks: `.kiro/specs/claude-code-agent-integration/tasks.md`
