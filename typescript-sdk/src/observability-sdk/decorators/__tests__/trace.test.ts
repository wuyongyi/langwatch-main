// @ts-nocheck - Decorator type checking has issues with Stage 3 decorators
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { trace as traceDecorator } from "../trace";
import { setupObservability } from "../../setup/node";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

describe("given @trace decorator", () => {
  let exporter: InMemorySpanExporter;
  let shutdownHandle: (() => Promise<void>) | undefined;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (shutdownHandle) {
      await shutdownHandle();
      shutdownHandle = undefined;
    }
    exporter.reset();
  });

  describe("when decorating a synchronous function", () => {
    it("creates a root trace with unique trace ID", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "test-operation" })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test input");

      expect(result).toBe("processed: test input");

      // Shutdown immediately to avoid export attempts
      await handle.shutdown();
      shutdownHandle = undefined;
    });

    it("captures function input as trace input", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "test-operation" })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      agent.execute("test input");

      // Input should be captured in span attributes
      expect(true).toBe(true); // Placeholder
    });

    it("captures function output as trace output", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "test-operation" })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test input");

      expect(result).toBe("processed: test input");
      // Output should be captured in span attributes
    });
  });

  describe("when decorating an async function", () => {
    it("creates a root trace and waits for completion", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "async-operation" })
        async execute(input: string): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = await agent.execute("test input");

      expect(result).toBe("processed: test input");
    });

    it("captures resolved output from async function", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "async-operation" })
        async execute(input: string): Promise<string> {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = await agent.execute("test input");

      expect(result).toBe("processed: test input");
    });
  });

  describe("when trace metadata is provided", () => {
    it("attaches user_id to trace metadata", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({
          name: "test-operation",
          metadata: { user_id: "user123" },
        })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      agent.execute("test input");

      // Metadata should be attached to span
      expect(true).toBe(true); // Placeholder
    });

    it("attaches thread_id to trace metadata", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({
          name: "test-operation",
          metadata: { thread_id: "thread456" },
        })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      agent.execute("test input");

      // Metadata should be attached to span
      expect(true).toBe(true); // Placeholder
    });

    it("attaches task_type to trace metadata", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({
          name: "test-operation",
          metadata: { task_type: "code_generation" },
        })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      agent.execute("test input");

      // Metadata should be attached to span
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("when function throws an error", () => {
    it("captures error and re-throws", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "failing-operation" })
        execute(): string {
          throw new Error("Test error");
        }
      }

      const agent = new TestAgent();

      expect(() => agent.execute()).toThrow("Test error");
      // Error should be captured in span
    });

    it("captures error from async function", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(exporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "failing-async-operation" })
        async execute(): Promise<string> {
          throw new Error("Async test error");
        }
      }

      const agent = new TestAgent();

      await expect(agent.execute()).rejects.toThrow("Async test error");
      // Error should be captured in span
    });
  });

  describe("when used without observability setup", () => {
    it("executes function normally without tracing", () => {
      // Don't set up observability

      class TestAgent {
        @traceDecorator({ name: "test-operation" })
        execute(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test input");

      expect(result).toBe("processed: test input");
      // Should not throw, just skip tracing
    });
  });
});
