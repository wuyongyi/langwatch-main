/**
 * @span decorator for creating nested spans in Claude Code agents.
 * 
 * This decorator wraps functions to automatically create OpenTelemetry spans
 * nested under the current active trace or span.
 */

import { getLangWatchTracer } from "../tracer";
import { shouldCaptureInput, shouldCaptureOutput } from "../config";
import { type AgentSpanType } from "../agent-instrumentation-types";

/**
 * Options for the @span decorator.
 */
export interface SpanOptions {
  /** Name of the span/operation */
  name: string;
  
  /** Span type (defaults to "agent" for skill executions) */
  type?: AgentSpanType;
}

/**
 * Decorator that creates a nested span for skill executions.
 * 
 * This decorator wraps a method to automatically create an OpenTelemetry span
 * nested under the current active trace or span. It captures the function's
 * input and output and handles both synchronous and asynchronous functions.
 * 
 * @param options - Configuration for the span
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * import { span } from "langwatch/observability";
 * 
 * class MyAgent {
 *   @span({ name: "code-generation" })
 *   async generateCode(prompt: string): Promise<string> {
 *     // Skill logic here
 *     return code;
 *   }
 * }
 * ```
 * 
 * @example With custom span type
 * ```typescript
 * class MyAgent {
 *   @span({ name: "database-query", type: "tool" })
 *   async queryDatabase(query: string): Promise<any[]> {
 *     return results;
 *   }
 * }
 * ```
 */
export function span(options: SpanOptions) {
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
      return legacySpanDecorator(options, target, propertyKey, descriptor);
    }
    
    // Standard decorator syntax
    return standardSpanDecorator(options, target, context);
  };
}

/**
 * Legacy decorator implementation (experimentalDecorators: true)
 */
function legacySpanDecorator(
  options: SpanOptions,
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    return executeWithSpan(options, originalMethod, this, args);
  };

  return descriptor;
}

/**
 * Standard decorator implementation (Stage 3 decorators)
 */
function standardSpanDecorator(
  options: SpanOptions,
  originalMethod: any,
  context: any
) {
  return function (this: any, ...args: any[]) {
    return executeWithSpan(options, originalMethod, this, args);
  };
}

/**
 * Core span execution logic shared by both decorator implementations
 */
function executeWithSpan(
  options: SpanOptions,
  originalMethod: Function,
  thisArg: any,
  args: any[]
) {
  // Get tracer - will use global provider if available
  const tracer = getLangWatchTracer(options.name);

  // Use withActiveSpan to create and manage the span
  // This automatically nests under the current active span/trace
  return tracer.withActiveSpan(options.name, (span) => {
    try {
      // Set span type (defaults to "agent" for skill executions)
      span.setType(options.type || "agent");

      // Capture input if enabled
      if (shouldCaptureInput() && args.length > 0) {
        span.setInput(serializeInput(args));
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

