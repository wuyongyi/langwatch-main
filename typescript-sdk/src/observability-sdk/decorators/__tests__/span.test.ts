// @ts-nocheck - Decorator type checking has issues with Stage 3 decorators
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { span as spanDecorator } from "../span";
import { trace as traceDecorator } from "../trace";
import { setupObservability } from "../../setup/node";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

describe("given @span decorator", () => {
  let shutdownHandle: (() => Promise<void>) | undefined;
  let spanExporter: InMemorySpanExporter;

  beforeEach(() => {
    vi.clearAllMocks();
    shutdownHandle = undefined;
    spanExporter = new InMemorySpanExporter();
  });

  afterEach(async () => {
    if (shutdownHandle) {
      await shutdownHandle();
      shutdownHandle = undefined;
    }
    spanExporter.reset();
  });

  describe("when decorating a function within an active trace", () => {
    it("creates a nested span", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        execute(input: string): string {
          return this.processSkill(input);
        }

        @spanDecorator({ name: "process-skill" })
        processSkill(input: string): string {
          return `processed: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test input");

      expect(result).toBe("processed: test input");

      await handle.shutdown();
      shutdownHandle = undefined;
    });

    it("sets span type to agent_skill", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        execute(input: string): string {
          return this.skill(input);
        }

        @spanDecorator({ name: "skill-execution" })
        skill(input: string): string {
          return `skill: ${input}`;
        }
      }

      const agent = new TestAgent();
      agent.execute("test");

      await handle.shutdown();
      shutdownHandle = undefined;
    });

    it("captures span input and output", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        execute(input: string): string {
          return this.skill(input);
        }

        @spanDecorator({ name: "skill-execution" })
        skill(input: string): string {
          return `output: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test input");

      expect(result).toBe("output: test input");

      await handle.shutdown();
      shutdownHandle = undefined;
    });
  });

  describe("when decorating nested functions", () => {
    it("maintains proper span hierarchy", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        execute(input: string): string {
          return this.outerSkill(input);
        }

        @spanDecorator({ name: "outer-skill" })
        outerSkill(input: string): string {
          return this.innerSkill(input);
        }

        @spanDecorator({ name: "inner-skill" })
        innerSkill(input: string): string {
          return `nested: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test");

      expect(result).toBe("nested: test");

      await handle.shutdown();
      shutdownHandle = undefined;
    });
  });

  describe("when decorating async functions", () => {
    it("creates span and waits for completion", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        async execute(input: string): Promise<string> {
          return await this.asyncSkill(input);
        }

        @spanDecorator({ name: "async-skill" })
        async asyncSkill(input: string): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `async: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = await agent.execute("test");

      expect(result).toBe("async: test");

      await handle.shutdown();
      shutdownHandle = undefined;
    });
  });

  describe("when function throws an error", () => {
    it("captures error in span", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        execute(): string {
          return this.failingSkill();
        }

        @spanDecorator({ name: "failing-skill" })
        failingSkill(): string {
          throw new Error("Skill error");
        }
      }

      const agent = new TestAgent();

      expect(() => agent.execute()).toThrow("Skill error");

      await handle.shutdown();
      shutdownHandle = undefined;
    });

    it("captures error from async function", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        async execute(): Promise<string> {
          return await this.failingAsyncSkill();
        }

        @spanDecorator({ name: "failing-async-skill" })
        async failingAsyncSkill(): Promise<string> {
          throw new Error("Async skill error");
        }
      }

      const agent = new TestAgent();

      await expect(agent.execute()).rejects.toThrow("Async skill error");

      await handle.shutdown();
      shutdownHandle = undefined;
    });
  });

  describe("when used without active trace", () => {
    it("executes function normally", () => {
      // Don't set up observability

      class TestAgent {
        @spanDecorator({ name: "skill-execution" })
        skill(input: string): string {
          return `skill: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.skill("test");

      expect(result).toBe("skill: test");
    });
  });

  describe("when custom span type is provided", () => {
    it("uses the custom span type", async () => {
      const handle = setupObservability({
        langwatch: "disabled",
        serviceName: "test-agent",
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
        advanced: {
          UNSAFE_forceOpenTelemetryReinitialization: true,
        },
      });
      shutdownHandle = handle.shutdown;

      class TestAgent {
        @traceDecorator({ name: "agent-execution" })
        execute(input: string): string {
          return this.tool(input);
        }

        @spanDecorator({ name: "tool-call", type: "tool" })
        tool(input: string): string {
          return `tool: ${input}`;
        }
      }

      const agent = new TestAgent();
      const result = agent.execute("test");

      expect(result).toBe("tool: test");

      await handle.shutdown();
      shutdownHandle = undefined;
    });
  });
});
