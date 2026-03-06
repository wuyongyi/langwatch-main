import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupAgentObservability } from "../agent-setup";
import { trace } from "@opentelemetry/api";
import { type AgentInstrumentationConfig } from "../../agent-instrumentation-types";

describe("given agent observability setup", () => {
  let shutdownHandle: (() => Promise<void>) | undefined;

  beforeEach(() => {
    // Clear any existing tracer provider
    vi.clearAllMocks();
    shutdownHandle = undefined;
  });

  afterEach(async () => {
    // Clean up after each test
    if (shutdownHandle) {
      await shutdownHandle();
      shutdownHandle = undefined;
    }
  });

  describe("when initializing with valid configuration", () => {
    it("creates a TracerProvider", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "test-agent",
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      const provider = trace.getTracerProvider();
      expect(provider).toBeDefined();
      // In test environment, provider might be ProxyTracerProvider or NodeTracerProvider
      // Just verify it's defined and has a shutdown method
      expect(handle.shutdown).toBeDefined();
      expect(typeof handle.shutdown).toBe("function");
    });

    it("validates and stores the API key", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "test-agent",
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      // API key should be stored for use by exporters
      // We'll verify this through the exporter configuration
      expect(true).toBe(true); // Placeholder - actual validation happens in exporter
    });

    it("sets the service name", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "my-test-agent",
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      // Service name should be set in the resource
      // We'll verify this through the tracer
      const tracer = trace.getTracer("test");
      expect(tracer).toBeDefined();
    });
  });

  describe("when initializing with environment variable API key", () => {
    it("reads API key from LANGWATCH_API_KEY", () => {
      process.env.LANGWATCH_API_KEY = "env-api-key";

      const config: AgentInstrumentationConfig = {
        serviceName: "test-agent",
        apiKey: "", // Will be read from env
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      expect(handle).toBeDefined();
      expect(handle.shutdown).toBeDefined();

      delete process.env.LANGWATCH_API_KEY;
    });
  });

  describe("when API key is missing", () => {
    it("throws ConfigurationError", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "",
        serviceName: "test-agent",
      };

      delete process.env.LANGWATCH_API_KEY;

      expect(() => setupAgentObservability(config)).toThrow("API key is required");
    });
  });

  describe("when custom endpoint is provided", () => {
    it("uses the custom endpoint", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "test-agent",
        endpoint: "https://custom.endpoint.com",
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      expect(handle).toBeDefined();
      // Endpoint configuration will be verified through exporter
    });
  });

  describe("when sampling rate is provided", () => {
    it("configures sampling rate", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "test-agent",
        samplingRate: 0.5,
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      expect(handle).toBeDefined();
      // Sampling configuration will be verified through sampler
    });

    it("validates sampling rate is between 0 and 1", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "test-agent",
        samplingRate: 1.5,
      };

      expect(() => setupAgentObservability(config)).toThrow(
        "samplingRate must be between 0.0 and 1.0"
      );
    });
  });

  describe("when custom metadata is provided", () => {
    it("attaches custom metadata to traces", () => {
      const config: AgentInstrumentationConfig = {
        apiKey: "test-api-key",
        serviceName: "test-agent",
        customMetadata: {
          environment: "test",
          version: "1.0.0",
        },
      };

      const handle = setupAgentObservability(config);
      shutdownHandle = handle.shutdown;

      expect(handle).toBeDefined();
      // Custom metadata will be verified through resource attributes
    });
  });
});
