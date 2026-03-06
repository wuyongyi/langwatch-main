/**
 * @trace decorator for creating root traces in Claude Code agents.
 * 
 * This decorator wraps functions to automatically create OpenTelemetry traces,
 * capturing input, output, and metadata for agent operations.
 */

import { trace as otelTrace, SpanStatusCode, type Span } from "@opentelemetry/api";
import { getLangWatchTracer } from "../tracer";
import { shouldCaptureInput, shouldCaptureOutput } from "../config";

/**
 * Options for the @trace decorator.
 */
export interface TraceOptions {
  /** Name of the trace/operation */
  name: string;
  
  /** Metadata to attach to the trace */
  metadata?: {
    user_id?: string;
    thread_id?: string;
    task_type?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Decorator that creates a root trace for agent operations.
 * 
 * This decorator wraps a method to automatically create an OpenTelemetry trace,
 * capturing the function's input and output. It handles both synchronous and
 * asynchronous functions.
 * 
 * @param options - Configuration for the trace
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * import { trace } from "langwatch/observability";
 * 
 * class MyAgent {
 *   @trace({ name: "agent-execution" })
 *   async execute(input: string): Promise<string> {
 *     // Agent logic here
 *     return result;
 *   }
 * }
 * ```
 * 
 * @example With metadata
 * ```typescript
 * class MyAgent {
 *   @trace({
 *     name: "agent-execution",
 *     metadata: {
 *       user_id: "user123",
 *       thread_id: "thread456",
 *       task_type: "code_generation"
 *     }
 *   })
 *   async execute(input: string): Promise<string> {
 *     return result;
 *   }
 * }
 * ```
 */
export function trace(options: TraceOptions) {
  return function (
    target: any,
    context?: any
  ) {
    // Handle both legacy and standard decorators
    // Legacy: (target, propertyKey, descriptor)
    // Standard: (target, context)
    
    // If context is a string, this is legacy decorator syntax
    if (typeof context === "string") {
      const propertyKey = context;
      const descriptor = arguments[2] as PropertyDescriptor;
      return legacyTraceDecorator(options, target, propertyKey, descriptor);
    }
    
    // Standard decorator syntax
    return standardTraceDecorator(options, target, context);
  };
}

/**
 * Legacy decorator implementation (experimentalDecorators: true)
 */
function legacyTraceDecorator(
  options: TraceOptions,
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    return executeWithTrace(options, originalMethod, this, args);
  };

  return descriptor;
}

/**
 * Standard decorator implementation (Stage 3 decorators)
 */
function standardTraceDecorator(
  options: TraceOptions,
  originalMethod: any,
  context: any
) {
  return function (this: any, ...args: any[]) {
    return executeWithTrace(options, originalMethod, this, args);
  };
}

/**
 * Core trace execution logic shared by both decorator implementations
 */
function executeWithTrace(
  options: TraceOptions,
  originalMethod: Function,
  thisArg: any,
  args: any[]
) {
  // Get tracer - will use global provider if available
  const tracer = getLangWatchTracer(options.name);

  // Use withActiveSpan to create and manage the span
  return tracer.withActiveSpan(options.name, (span) => {
    try {
      // Set span type to "agent" for root traces
      span.setType("agent");

      // Capture input if enabled
      if (shouldCaptureInput() && args.length > 0) {
        span.setInput(serializeInput(args));
      }

      // Attach metadata if provided
      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          if (value !== undefined) {
            span.setAttribute(`langwatch.${key}`, value);
          }
        }
      }

      // Execute the original method
      const result = originalMethod.apply(thisArg, args);

      // Handle async functions
      if (result && typeof result.then === "function") {
        return result
          .then((resolvedResult: any) => {
            // Capture output if enabled
            if (shouldCaptureOutput()) {
              span.setOutput(serializeOutput(resolvedResult));
            }
            return resolvedResult;
          })
          .catch((error: any) => {
            // Error handling is done by withActiveSpan
            throw error;
          });
      }

      // Handle sync functions
      if (shouldCaptureOutput()) {
        span.setOutput(serializeOutput(result));
      }

      return result;
    } catch (error) {
      // Error handling is done by withActiveSpan
      throw error;
    }
  });
}

/**
 * Serialize function input for tracing.
 * Handles various input types and converts them to a traceable format.
 */
function serializeInput(args: any[]): any {
  if (args.length === 0) {
    return undefined;
  }

  if (args.length === 1) {
    return serializeValue(args[0]);
  }

  return args.map(serializeValue);
}

/**
 * Serialize function output for tracing.
 */
function serializeOutput(output: any): any {
  return serializeValue(output);
}

/**
 * Serialize a value for tracing.
 * Handles primitives, objects, arrays, and special types.
 */
function serializeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Primitives
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  // Objects
  if (typeof value === "object") {
    try {
      // Try to serialize as JSON
      return JSON.parse(JSON.stringify(value));
    } catch {
      // If serialization fails, return string representation
      return String(value);
    }
  }

  // Fallback to string
  return String(value);
}
