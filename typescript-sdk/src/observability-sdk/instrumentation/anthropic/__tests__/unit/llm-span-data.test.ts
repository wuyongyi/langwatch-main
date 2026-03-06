/**
 * Unit tests for LLM span data capture.
 * 
 * Tests token extraction, cost calculation, latency recording,
 * and response content capture from Claude API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { instrumentClaudeClient } from "../../index";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { trace } from "@opentelemetry/api";

describe("given an instrumented Claude client", () => {
  let exporter: InMemorySpanExporter;
  let provider: NodeTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(async () => {
    await provider.shutdown();
    trace.disable();
    exporter.reset();
  });

  describe("when API returns token usage", () => {
    it("captures prompt tokens in span attributes", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 15,
              output_tokens: 8,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      expect(spans[0]?.attributes["gen_ai.usage.prompt_tokens"]).toBe(15);
    });

    it("captures completion tokens in span attributes", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 15,
              output_tokens: 8,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      expect(spans[0]?.attributes["gen_ai.usage.completion_tokens"]).toBe(8);
    });

    it("captures total tokens in span attributes", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 15,
              output_tokens: 8,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      // Total tokens = input_tokens + output_tokens
      expect(spans[0]?.attributes["gen_ai.usage.total_tokens"]).toBe(23);
    });
  });

  describe("when API returns response content", () => {
    it("captures text response as output", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello, how can I help you?" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 7,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const output = JSON.parse(spans[0]?.attributes["langwatch.output"] as string);
      expect(output.type).toBe("text");
      expect(output.value).toBe("Hello, how can I help you?");
    });

    it("concatenates multiple text content blocks", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [
              { type: "text", text: "First part. " },
              { type: "text", text: "Second part." },
            ],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 7,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const output = JSON.parse(spans[0]?.attributes["langwatch.output"] as string);
      expect(output.value).toBe("First part. Second part.");
    });

    it("filters out non-text content blocks", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [
              { type: "text", text: "Text content" },
              { type: "tool_use", id: "tool_123", name: "calculator" },
            ],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 7,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const output = JSON.parse(spans[0]?.attributes["langwatch.output"] as string);
      expect(output.value).toBe("Text content");
    });
  });

  describe("when measuring API latency", () => {
    it("records API latency in milliseconds", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockImplementation(async () => {
            // Simulate API delay
            await new Promise((resolve) => setTimeout(resolve, 50));
            return {
              id: "msg_123",
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: "Hello!" }],
              model: "claude-3-5-sonnet-20241022",
              usage: {
                input_tokens: 10,
                output_tokens: 5,
              },
            };
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      // Span duration is in nanoseconds, convert to milliseconds
      const durationMs = (spans[0]?.duration[0] ?? 0) * 1000 + (spans[0]?.duration[1] ?? 0) / 1_000_000;
      
      // Should be at least 50ms due to our simulated delay
      expect(durationMs).toBeGreaterThanOrEqual(50);
    });
  });

  describe("when calculating cost", () => {
    it("calculates cost for claude-3-5-sonnet-20241022", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const cost = spans[0]?.attributes["langwatch.cost"];
      
      // Claude 3.5 Sonnet pricing: $3/MTok input, $15/MTok output
      // Cost = (1000 * 3 / 1_000_000) + (500 * 15 / 1_000_000)
      // Cost = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it("calculates cost for claude-3-opus-20240229", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-opus-20240229",
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-opus-20240229",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const cost = spans[0]?.attributes["langwatch.cost"];
      
      // Claude 3 Opus pricing: $15/MTok input, $75/MTok output
      // Cost = (1000 * 15 / 1_000_000) + (500 * 75 / 1_000_000)
      // Cost = 0.015 + 0.0375 = 0.0525
      expect(cost).toBe(0.0525);
    });

    it("calculates cost for claude-3-haiku-20240307", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-haiku-20240307",
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const cost = spans[0]?.attributes["langwatch.cost"];
      
      // Claude 3 Haiku pricing: $0.25/MTok input, $1.25/MTok output
      // Cost = (1000 * 0.25 / 1_000_000) + (500 * 1.25 / 1_000_000)
      // Cost = 0.00025 + 0.000625 = 0.000875
      expect(cost).toBe(0.000875);
    });

    it("handles unknown models with zero cost", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-unknown-model",
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-unknown-model",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      const spans = exporter.getFinishedSpans();
      const cost = spans[0]?.attributes["langwatch.cost"];
      
      expect(cost).toBe(0);
    });
  });
});
