# Error Handling and Retry Logic

This module provides comprehensive error handling and retry logic for the LangWatch Observability SDK.

## Components

### Error Classes

Three specialized error types for different failure scenarios:

- **InstrumentationError**: Non-blocking errors during span/trace creation
- **ExportError**: Failures when exporting traces to LangWatch
- **ConfigurationError**: Invalid configuration at initialization time

```typescript
import { InstrumentationError, ExportError, ConfigurationError } from '@langwatch/observability/errors';

// Non-blocking instrumentation error
try {
  span.setAttribute("key", value);
} catch (error) {
  throw new InstrumentationError("Failed to set attribute", error);
}

// Export failure
try {
  await exporter.export(spans);
} catch (error) {
  throw new ExportError("Failed to export traces", error);
}

// Configuration error
if (!apiKey) {
  throw new ConfigurationError("LANGWATCH_API_KEY is required");
}
```

### Graceful Exporter

Provides graceful degradation when the LangWatch endpoint is unavailable:

- Queues traces locally when export fails
- Drops oldest traces when queue limit is reached (FIFO)
- Continues agent execution even if tracing fails
- Periodically attempts to flush the queue

```typescript
import { LangWatchTraceExporter, GracefulExporter } from '@langwatch/observability';

const baseExporter = new LangWatchTraceExporter();
const exporter = new GracefulExporter(baseExporter, {
  maxQueueSize: 500,
  onTracesDropped: (count) => console.warn(`Dropped ${count} traces`),
  onExportError: (error) => console.error('Export failed:', error),
});
```

**Features:**
- Automatic queue management with configurable size
- FIFO dropping when queue is full
- Periodic flush attempts every 30 seconds
- Graceful shutdown with final flush attempt

### Retry Exporter

Provides exponential backoff retry logic for export failures:

- Retries failed exports with exponential backoff
- Configurable retry count and delay parameters
- Caps maximum delay to prevent excessive waiting
- Invokes callback when retries are exhausted

```typescript
import { LangWatchTraceExporter, RetryExporter } from '@langwatch/observability';

const baseExporter = new LangWatchTraceExporter();
const exporter = new RetryExporter(baseExporter, {
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  onRetriesExhausted: (error, spans) => {
    console.error('All retries exhausted:', error);
  },
});
```

**Retry Schedule Example:**
- Attempt 1: Immediate
- Attempt 2: 500ms delay
- Attempt 3: 1000ms delay (500 * 2^1)
- Attempt 4: 2000ms delay (500 * 2^2)
- Attempt 5: 4000ms delay (500 * 2^3)
- Attempt 6: 8000ms delay (500 * 2^4)

**Helper Function:**

```typescript
import { exportWithRetry } from '@langwatch/observability/exporters';

await exportWithRetry(exporter, spans, {
  maxRetries: 3,
  initialDelayMs: 1000,
});
```

## Combining Strategies

You can combine graceful degradation with retry logic:

```typescript
import { 
  LangWatchTraceExporter, 
  RetryExporter, 
  GracefulExporter 
} from '@langwatch/observability';

// Base exporter
const baseExporter = new LangWatchTraceExporter();

// Add retry logic
const retryExporter = new RetryExporter(baseExporter, {
  maxRetries: 3,
  initialDelayMs: 1000,
});

// Add graceful degradation
const exporter = new GracefulExporter(retryExporter, {
  maxQueueSize: 1000,
});
```

This configuration:
1. Attempts export with exponential backoff (up to 3 retries)
2. If all retries fail, queues spans locally
3. Periodically attempts to flush the queue
4. Drops oldest spans if queue exceeds 1000

## Design Principles

1. **Non-blocking**: Agent execution continues even if tracing fails
2. **Graceful Degradation**: System degrades gracefully under failure conditions
3. **Automatic Recovery**: Periodic flush attempts enable automatic recovery
4. **Configurable**: All parameters are configurable for different use cases
5. **Observable**: Callbacks provide visibility into error conditions

## Testing

All components have comprehensive unit tests:

```bash
pnpm test:unit errors.unit.test.ts
pnpm test:unit graceful-exporter.unit.test.ts
pnpm test:unit retry-exporter.unit.test.ts
```

## Requirements Satisfied

- ✅ InstrumentationError for non-blocking errors
- ✅ ExportError for export failures
- ✅ ConfigurationError for initialization errors
- ✅ Queue traces locally when endpoint unavailable
- ✅ Drop oldest traces when queue limit reached (FIFO)
- ✅ Continue agent execution even if tracing fails
- ✅ RetryConfig interface with retry parameters
- ✅ exportWithRetry() function
- ✅ Exponential backoff with max delay cap
