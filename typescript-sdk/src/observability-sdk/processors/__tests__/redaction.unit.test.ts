import { describe, it, expect } from "vitest";
import {
  type RedactionRule,
  createDefaultRedactionRules,
  applyRedaction,
  redactValue,
} from "../redaction";

describe("given redaction rules engine", () => {
  describe("when creating default redaction rules", () => {
    it("includes API key pattern rule", () => {
      const rules = createDefaultRedactionRules();
      const apiKeyRule = rules.find(r => r.name === "api_key");
      
      expect(apiKeyRule).toBeDefined();
      expect(apiKeyRule?.pattern).toBeInstanceOf(RegExp);
    });

    it("includes Bearer token pattern rule", () => {
      const rules = createDefaultRedactionRules();
      const bearerRule = rules.find(r => r.name === "bearer_token");
      
      expect(bearerRule).toBeDefined();
      expect(bearerRule?.pattern).toBeInstanceOf(RegExp);
    });

    it("includes password pattern rule", () => {
      const rules = createDefaultRedactionRules();
      const passwordRule = rules.find(r => r.name === "password");
      
      expect(passwordRule).toBeDefined();
      expect(passwordRule?.pattern).toBeInstanceOf(RegExp);
    });
  });

  describe("when redacting API keys", () => {
    it("redacts OpenAI-style API keys", () => {
      const input = "My API key is sk-1234567890abcdef";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toBe("My API key is sk-***REDACTED***");
    });

    it("redacts multiple API keys in same string", () => {
      const input = "Keys: sk-abc123 and sk-def456";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toContain("***REDACTED***");
      expect(result).not.toContain("sk-abc123");
      expect(result).not.toContain("sk-def456");
    });

    it("preserves non-sensitive text", () => {
      const input = "Hello world, this is normal text";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toBe("Hello world, this is normal text");
    });
  });

  describe("when redacting Bearer tokens", () => {
    it("redacts JWT Bearer tokens", () => {
      const input = "Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toBe("Token: Bearer ***REDACTED***");
    });

    it("redacts Bearer tokens case-insensitively", () => {
      const input = "Auth: bearer secret-token-12345";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toContain("***REDACTED***");
      expect(result).not.toContain("secret-token-12345");
    });
  });

  describe("when redacting passwords", () => {
    it("redacts password= patterns", () => {
      const input = "password=mySecretPass123";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toBe("password=***REDACTED***");
    });

    it("redacts pwd= patterns", () => {
      const input = "pwd=secret123";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toBe("pwd=***REDACTED***");
    });
  });

  describe("when applying multiple redaction rules", () => {
    it("applies all matching rules to same string", () => {
      const input = "API key sk-abc123 and password=secret";
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).not.toContain("sk-abc123");
      expect(result).not.toContain("secret");
      expect(result).toContain("***REDACTED***");
    });
  });

  describe("when using custom redaction rules", () => {
    it("applies custom pattern rules", () => {
      const customRule: RedactionRule = {
        name: "custom_secret",
        pattern: /secret-key-[a-z0-9]+/gi,
        replacement: "***REDACTED***",
      };
      
      const input = "My secret-key-abc123 is here";
      const result = redactValue(input, [customRule]);
      
      expect(result).toBe("My ***REDACTED*** is here");
    });

    it("combines custom rules with default rules", () => {
      const customRule: RedactionRule = {
        name: "custom_secret",
        pattern: /secret-key-[a-z0-9]+/gi,
        replacement: "***REDACTED***",
      };
      
      const rules = [...createDefaultRedactionRules(), customRule];
      const input = "API: sk-123 and secret-key-abc";
      const result = redactValue(input, rules);
      
      expect(result).not.toContain("sk-123");
      expect(result).not.toContain("secret-key-abc");
    });
  });

  describe("when redacting non-string values", () => {
    it("returns numbers unchanged", () => {
      const result = redactValue(42, createDefaultRedactionRules());
      expect(result).toBe(42);
    });

    it("returns booleans unchanged", () => {
      const result = redactValue(true, createDefaultRedactionRules());
      expect(result).toBe(true);
    });

    it("returns null unchanged", () => {
      const result = redactValue(null, createDefaultRedactionRules());
      expect(result).toBe(null);
    });

    it("returns undefined unchanged", () => {
      const result = redactValue(undefined, createDefaultRedactionRules());
      expect(result).toBe(undefined);
    });
  });

  describe("when redacting objects", () => {
    it("redacts string values in objects", () => {
      const input = { key: "sk-abc123", normal: "text" };
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toEqual({
        key: "sk-***REDACTED***",
        normal: "text",
      });
    });

    it("recursively redacts nested objects", () => {
      const input = {
        outer: {
          inner: "password=secret",
          safe: "normal",
        },
      };
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result).toEqual({
        outer: {
          inner: "password=***REDACTED***",
          safe: "normal",
        },
      });
    });
  });

  describe("when redacting arrays", () => {
    it("redacts string values in arrays", () => {
      const input = ["sk-abc123", "normal text", "Bearer token123"];
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result[0]).toContain("***REDACTED***");
      expect(result[1]).toBe("normal text");
      expect(result[2]).toContain("***REDACTED***");
    });

    it("recursively redacts nested arrays", () => {
      const input = [["sk-abc123"], ["normal"]];
      const result = redactValue(input, createDefaultRedactionRules());
      
      expect(result[0][0]).toContain("***REDACTED***");
      expect(result[1][0]).toBe("normal");
    });
  });

  describe("when applying redaction to span attributes", () => {
    it("redacts sensitive data in input attribute", () => {
      const attributes = {
        "langwatch.input": JSON.stringify({
          type: "text",
          value: "My API key is sk-abc123",
        }),
      };
      
      const result = applyRedaction(attributes, createDefaultRedactionRules());
      const parsed = JSON.parse(result["langwatch.input"] as string);
      
      expect(parsed.value).toContain("***REDACTED***");
      expect(parsed.value).not.toContain("sk-abc123");
    });

    it("redacts sensitive data in output attribute", () => {
      const attributes = {
        "langwatch.output": JSON.stringify({
          type: "text",
          value: "Token: Bearer secret123",
        }),
      };
      
      const result = applyRedaction(attributes, createDefaultRedactionRules());
      const parsed = JSON.parse(result["langwatch.output"] as string);
      
      expect(parsed.value).toContain("***REDACTED***");
      expect(parsed.value).not.toContain("secret123");
    });

    it("preserves non-sensitive attributes", () => {
      const attributes = {
        "langwatch.span.type": "llm",
        "gen_ai.request.model": "gpt-4",
        "custom.metadata": "normal value",
      };
      
      const result = applyRedaction(attributes, createDefaultRedactionRules());
      
      expect(result).toEqual(attributes);
    });

    it("handles malformed JSON gracefully", () => {
      const attributes = {
        "langwatch.input": "not valid json",
      };
      
      const result = applyRedaction(attributes, createDefaultRedactionRules());
      
      expect(result["langwatch.input"]).toBe("not valid json");
    });
  });
});
