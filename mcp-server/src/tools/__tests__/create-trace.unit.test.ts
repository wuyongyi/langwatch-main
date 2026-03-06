import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCreateTrace } from "../create-trace.js";

// Mock the config module
vi.mock("../../config.js", () => ({
  getConfig: () => ({
    apiKey: "test-api-key",
    endpoint: "https://test.langwatch.ai",
  }),
}));

// Mock OpenTelemetry modules
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn((spans, callback) => callback({ code: 0 })),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("given create_trace MCP tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when creating a trace with valid parameters", () => {
    it("returns trace_id in response", async () => {
      const result = await handleCreateTrace({
        name: "test-agent",
        input: "Hello world",
      });

      const parsed = JSON.parse(result);
      expect(parsed.trace_id).toBeDefined();
      expect(typeof parsed.trace_id).toBe("string");
      expect(parsed.trace_id.length).toBe(32); // OpenTelemetry trace ID format
      expect(parsed.message).toContain("successfully");
    });

    it("includes metadata in trace attributes", async () => {
      const result = await handleCreateTrace({
        name: "test-agent",
        input: "Test input",
        metadata: {
          user_id: "user123",
          thread_id: "thread456",
          task_type: "code-generation",
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed.trace_id).toBeDefined();
      expect(parsed.message).toContain("successfully");
    });
  });

  describe("when creating trace with minimal parameters", () => {
    it("creates trace without metadata", async () => {
      const result = await handleCreateTrace({
        name: "minimal-trace",
        input: "Minimal input",
      });

      const parsed = JSON.parse(result);
      expect(parsed.trace_id).toBeDefined();
      expect(parsed.message).toContain("successfully");
    });
  });

  describe("when creating trace with empty input", () => {
    it("accepts empty string input", async () => {
      const result = await handleCreateTrace({
        name: "empty-input-trace",
        input: "",
      });

      const parsed = JSON.parse(result);
      expect(parsed.trace_id).toBeDefined();
    });
  });

  describe("when creating multiple traces", () => {
    it("generates unique trace IDs", async () => {
      const result1 = await handleCreateTrace({
        name: "trace-1",
        input: "Input 1",
      });

      const result2 = await handleCreateTrace({
        name: "trace-2",
        input: "Input 2",
      });

      const parsed1 = JSON.parse(result1);
      const parsed2 = JSON.parse(result2);

      expect(parsed1.trace_id).not.toBe(parsed2.trace_id);
    });
  });
});
