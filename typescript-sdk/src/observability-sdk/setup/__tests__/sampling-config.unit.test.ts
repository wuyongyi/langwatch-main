/**
 * Unit tests for sampling configuration validation.
 * 
 * Tests the sampling rate validation logic in agent setup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupAgentObservability, ConfigurationError } from "../agent-setup";

describe("given agent observability setup", () => {
  let shutdownHandle: (() => Promise<void>) | undefined;

  beforeEach(() => {
    shutdownHandle = undefined;
  });

  afterEach(async () => {
    if (shutdownHandle) {
      await shutdownHandle();
      shutdownHandle = undefined;
    }
  });

  describe("when configuring sampling rate", () => {
    it("accepts sampling rate of 0.0", () => {
      expect(() => {
        const handle = setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
          samplingRate: 0.0,
        });
        shutdownHandle = handle.shutdown;
      }).not.toThrow();
    });

    it("accepts sampling rate of 1.0", () => {
      expect(() => {
        const handle = setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
          samplingRate: 1.0,
        });
        shutdownHandle = handle.shutdown;
      }).not.toThrow();
    });

    it("accepts sampling rate of 0.5", () => {
      expect(() => {
        const handle = setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
          samplingRate: 0.5,
        });
        shutdownHandle = handle.shutdown;
      }).not.toThrow();
    });

    it("rejects sampling rate below 0.0", () => {
      expect(() => {
        setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
          samplingRate: -0.1,
        });
      }).toThrow(ConfigurationError);
    });

    it("rejects sampling rate above 1.0", () => {
      expect(() => {
        setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
          samplingRate: 1.5,
        });
      }).toThrow(ConfigurationError);
    });

    it("includes correct error message for invalid sampling rate", () => {
      expect(() => {
        setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
          samplingRate: 2.0,
        });
      }).toThrow("samplingRate must be between 0.0 and 1.0");
    });

    it("uses default sampling rate when not specified", () => {
      // Should not throw - undefined sampling rate is valid
      expect(() => {
        const handle = setupAgentObservability({
          apiKey: "test-key",
          serviceName: "test-service",
        });
        shutdownHandle = handle.shutdown;
      }).not.toThrow();
    });
  });
});
