import { describe, it, expect } from "vitest";
import { MockSpan, testScenarios } from "../../__tests__/test-utils";
import { createLangWatchSpan } from "../implementation";

describe("given LangWatchSpan with custom metadata", () => {
  describe("when attaching string metadata", () => {
    it("sets string metadata attribute", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("environment", "production");
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.environment")).toBe("production");
    });

    it("allows multiple string metadata fields", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan
        .setMetadata("environment", "production")
        .setMetadata("version", "1.2.3")
        .setMetadata("region", "us-east-1");
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.environment")).toBe("production");
      expect(mockSpan.getAttributeValue("langwatch.metadata.version")).toBe("1.2.3");
      expect(mockSpan.getAttributeValue("langwatch.metadata.region")).toBe("us-east-1");
    });
  });

  describe("when attaching number metadata", () => {
    it("sets number metadata attribute", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("retry_count", 3);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.retry_count")).toBe(3);
    });

    it("handles zero values", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("error_count", 0);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.error_count")).toBe(0);
    });

    it("handles negative values", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("temperature", -5);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.temperature")).toBe(-5);
    });
  });

  describe("when attaching boolean metadata", () => {
    it("sets true boolean metadata", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("is_test", true);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.is_test")).toBe(true);
    });

    it("sets false boolean metadata", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("is_cached", false);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.is_cached")).toBe(false);
    });
  });

  describe("when attaching array metadata", () => {
    it("sets string array metadata", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("tags", ["urgent", "customer-facing"]);
      
      const value = mockSpan.getAttributeValue("langwatch.metadata.tags");
      expect(value).toEqual(["urgent", "customer-facing"]);
    });

    it("sets number array metadata", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("scores", [1, 2, 3]);
      
      const value = mockSpan.getAttributeValue("langwatch.metadata.scores");
      expect(value).toEqual([1, 2, 3]);
    });

    it("sets boolean array metadata", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("flags", [true, false, true]);
      
      const value = mockSpan.getAttributeValue("langwatch.metadata.flags");
      expect(value).toEqual([true, false, true]);
    });

    it("handles empty arrays", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("empty", []);
      
      const value = mockSpan.getAttributeValue("langwatch.metadata.empty");
      expect(value).toEqual([]);
    });
  });

  describe("when attaching multiple metadata types", () => {
    it("supports all types on same span", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan
        .setMetadata("operation", "query")
        .setMetadata("timeout_ms", 5000)
        .setMetadata("cached", false)
        .setMetadata("tags", ["important", "monitored"]);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.operation")).toBe("query");
      expect(mockSpan.getAttributeValue("langwatch.metadata.timeout_ms")).toBe(5000);
      expect(mockSpan.getAttributeValue("langwatch.metadata.cached")).toBe(false);
      expect(mockSpan.getAttributeValue("langwatch.metadata.tags")).toEqual(["important", "monitored"]);
    });
  });

  describe("when using setMetadataBatch", () => {
    it("sets multiple metadata fields at once", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadataBatch({
        environment: "production",
        version: "1.2.3",
        retry_count: 3,
        is_test: false,
        tags: ["urgent", "customer-facing"],
      });
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.environment")).toBe("production");
      expect(mockSpan.getAttributeValue("langwatch.metadata.version")).toBe("1.2.3");
      expect(mockSpan.getAttributeValue("langwatch.metadata.retry_count")).toBe(3);
      expect(mockSpan.getAttributeValue("langwatch.metadata.is_test")).toBe(false);
      expect(mockSpan.getAttributeValue("langwatch.metadata.tags")).toEqual(["urgent", "customer-facing"]);
    });

    it("can be chained with other methods", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan
        .setType("llm")
        .setMetadataBatch({ env: "prod", version: "1.0" })
        .setInput("test input");
      
      expect(mockSpan.getAttributeValue("langwatch.span.type")).toBe("llm");
      expect(mockSpan.getAttributeValue("langwatch.metadata.env")).toBe("prod");
      expect(mockSpan.getAttributeValue("langwatch.metadata.version")).toBe("1.0");
    });
  });

  describe("when metadata key contains special characters", () => {
    it("handles keys with underscores", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("user_id", "123");
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.user_id")).toBe("123");
    });

    it("handles keys with dots", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("config.timeout", 5000);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.config.timeout")).toBe(5000);
    });

    it("handles keys with hyphens", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("api-version", "v2");
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.api-version")).toBe("v2");
    });
  });

  describe("when overwriting existing metadata", () => {
    it("updates metadata value", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("status", "pending");
      langwatchSpan.setMetadata("status", "completed");
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.status")).toBe("completed");
    });

    it("allows changing metadata type", () => {
      const { mockSpan, langwatchSpan } = testScenarios.createSpanTest();
      
      langwatchSpan.setMetadata("value", "string");
      langwatchSpan.setMetadata("value", 123);
      
      expect(mockSpan.getAttributeValue("langwatch.metadata.value")).toBe(123);
    });
  });

  describe("when chaining metadata methods", () => {
    it("returns this for method chaining", () => {
      const { langwatchSpan } = testScenarios.createSpanTest();
      
      const result = langwatchSpan
        .setMetadata("key1", "value1")
        .setMetadata("key2", "value2")
        .setMetadata("key3", "value3");
      
      expect(result).toBe(langwatchSpan);
    });
  });
});
