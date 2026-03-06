/**
 * Unit tests for Claude API client instrumentation.
 * 
 * Tests the instrumentClaudeClient function that wraps Anthropic client
 * methods to create LLM spans automatically.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { instrumentClaudeClient } from "../../index";
import { getLangWatchTracer } from "../../../../tracer";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { trace } from "@opentelemetry/api";

describe("given a Claude API client", () => {
  let exporter: InMemorySpanExporter;
  let provider: NodeTracerProvider;

  beforeEach(() => {
    // Set up in-memory span exporter for testing
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

  describe("when instrumenting the client", () => {
    it("returns a wrapped client", () => {
      const mockClient = {
        messages: {
          create: vi.fn(),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      expect(instrumented).toBeDefined();
      expect(instrumented.messages).toBeDefined();
      expect(instrumented.messages.create).toBeDefined();
    });

    it("preserves the original client interface", () => {
      const mockClient = {
        messages: {
          create: vi.fn(),
        },
        apiKey: "test-key",
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      expect(instrumented.apiKey).toBe("test-key");
    });
  });

  describe("when calling messages.create", () => {
    it("creates an LLM span", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 5,
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
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe("claude.messages.create");
    });

    it("captures model name in span attributes", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 5,
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
      expect(spans[0]?.attributes["gen_ai.request.model"]).toBe("claude-3-5-sonnet-20241022");
    });

    it("captures request messages in span input", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 5,
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
      const input = JSON.parse(spans[0]?.attributes["langwatch.input"] as string);
      expect(input.type).toBe("chat_messages");
      expect(input.value).toEqual([{ role: "user", content: "Hi" }]);
    });

    it("captures request parameters", async () => {
      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-5-sonnet-20241022",
            usage: {
              input_tokens: 10,
              output_tokens: 5,
            },
          }),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
        temperature: 0.7,
      });

      const spans = exporter.getFinishedSpans();
      expect(spans[0]?.attributes["gen_ai.request.max_tokens"]).toBe(100);
      expect(spans[0]?.attributes["gen_ai.request.temperature"]).toBe(0.7);
    });

    it("calls the original client method", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello!" }],
        model: "claude-3-5-sonnet-20241022",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });

      const mockClient = {
        messages: {
          create: mockCreate,
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      const params = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      };

      await instrumented.messages.create(params);

      expect(mockCreate).toHaveBeenCalledWith(params);
    });

    it("returns the original response", async () => {
      const expectedResponse = {
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

      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue(expectedResponse),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      const response = await instrumented.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      });

      expect(response).toEqual(expectedResponse);
    });
  });

  describe("when API call fails", () => {
    it("captures error in span", async () => {
      const error = new Error("API Error");
      const mockClient = {
        messages: {
          create: vi.fn().mockRejectedValue(error),
        },
      };

      const instrumented = instrumentClaudeClient(mockClient as any);

      await expect(
        instrumented.messages.create({
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 100,
        })
      ).rejects.toThrow("API Error");

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(2); // ERROR
    });
  });
});
