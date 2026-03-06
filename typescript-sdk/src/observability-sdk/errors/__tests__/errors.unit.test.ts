import { describe, it, expect } from "vitest";
import {
  InstrumentationError,
  ExportError,
  ConfigurationError,
} from "../index";

describe("given error classes", () => {
  describe("when creating an InstrumentationError", () => {
    it("creates error with message and name", () => {
      const error = new InstrumentationError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("InstrumentationError");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InstrumentationError);
    });

    it("captures cause when provided", () => {
      const cause = new Error("Original error");
      const error = new InstrumentationError("Wrapped error", cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toBe("Wrapped error");
    });

    it("has undefined cause when not provided", () => {
      const error = new InstrumentationError("Test error");

      expect(error.cause).toBeUndefined();
    });

    it("maintains stack trace", () => {
      const error = new InstrumentationError("Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("InstrumentationError");
    });
  });

  describe("when creating an ExportError", () => {
    it("creates error with message and name", () => {
      const error = new ExportError("Export failed");

      expect(error.message).toBe("Export failed");
      expect(error.name).toBe("ExportError");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ExportError);
    });

    it("captures cause when provided", () => {
      const cause = new Error("Network timeout");
      const error = new ExportError("Failed to send traces", cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toBe("Failed to send traces");
    });

    it("has undefined cause when not provided", () => {
      const error = new ExportError("Export failed");

      expect(error.cause).toBeUndefined();
    });

    it("maintains stack trace", () => {
      const error = new ExportError("Export failed");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ExportError");
    });
  });

  describe("when creating a ConfigurationError", () => {
    it("creates error with message and name", () => {
      const error = new ConfigurationError("Invalid config");

      expect(error.message).toBe("Invalid config");
      expect(error.name).toBe("ConfigurationError");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigurationError);
    });

    it("maintains stack trace", () => {
      const error = new ConfigurationError("Invalid config");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ConfigurationError");
    });

    it("does not have a cause property", () => {
      const error = new ConfigurationError("Invalid config");

      expect("cause" in error).toBe(false);
    });
  });

  describe("when distinguishing error types", () => {
    it("differentiates InstrumentationError from other errors", () => {
      const instrError = new InstrumentationError("Test");
      const exportError = new ExportError("Test");
      const configError = new ConfigurationError("Test");

      expect(instrError).toBeInstanceOf(InstrumentationError);
      expect(instrError).not.toBeInstanceOf(ExportError);
      expect(instrError).not.toBeInstanceOf(ConfigurationError);
    });

    it("differentiates ExportError from other errors", () => {
      const instrError = new InstrumentationError("Test");
      const exportError = new ExportError("Test");
      const configError = new ConfigurationError("Test");

      expect(exportError).toBeInstanceOf(ExportError);
      expect(exportError).not.toBeInstanceOf(InstrumentationError);
      expect(exportError).not.toBeInstanceOf(ConfigurationError);
    });

    it("differentiates ConfigurationError from other errors", () => {
      const instrError = new InstrumentationError("Test");
      const exportError = new ExportError("Test");
      const configError = new ConfigurationError("Test");

      expect(configError).toBeInstanceOf(ConfigurationError);
      expect(configError).not.toBeInstanceOf(InstrumentationError);
      expect(configError).not.toBeInstanceOf(ExportError);
    });
  });
});
