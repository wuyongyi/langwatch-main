import { describe, it, expect } from "vitest";
import {
  redactHeaders,
  createHeaderRedactionRules,
} from "../redaction";

describe("given header redaction", () => {
  describe("when redacting Authorization headers", () => {
    it("redacts Authorization header value", () => {
      const headers = {
        "Authorization": "Bearer secret-token-12345",
        "Content-Type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["Authorization"]).toBe("[REDACTED]");
      expect(result["Content-Type"]).toBe("application/json");
    });

    it("redacts authorization header (lowercase)", () => {
      const headers = {
        "authorization": "Bearer secret-token-12345",
        "content-type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["authorization"]).toBe("[REDACTED]");
      expect(result["content-type"]).toBe("application/json");
    });
  });

  describe("when redacting API key headers", () => {
    it("redacts x-api-key header", () => {
      const headers = {
        "x-api-key": "sk-1234567890abcdef",
        "Content-Type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["x-api-key"]).toBe("[REDACTED]");
      expect(result["Content-Type"]).toBe("application/json");
    });

    it("redacts X-API-Key header (mixed case)", () => {
      const headers = {
        "X-API-Key": "sk-1234567890abcdef",
        "Content-Type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["X-API-Key"]).toBe("[REDACTED]");
    });

    it("redacts api-key header", () => {
      const headers = {
        "api-key": "secret123",
        "Content-Type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["api-key"]).toBe("[REDACTED]");
    });
  });

  describe("when redacting custom token headers", () => {
    it("redacts custom-token header", () => {
      const headers = {
        "custom-token": "token123",
        "Content-Type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["custom-token"]).toBe("[REDACTED]");
    });

    it("redacts x-auth-token header", () => {
      const headers = {
        "x-auth-token": "token123",
        "Content-Type": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["x-auth-token"]).toBe("[REDACTED]");
    });
  });

  describe("when redacting multiple sensitive headers", () => {
    it("redacts all sensitive headers", () => {
      const headers = {
        "Authorization": "Bearer token1",
        "x-api-key": "key123",
        "custom-token": "token456",
        "Content-Type": "application/json",
        "Accept": "application/json",
      };
      
      const result = redactHeaders(headers);
      
      expect(result["Authorization"]).toBe("[REDACTED]");
      expect(result["x-api-key"]).toBe("[REDACTED]");
      expect(result["custom-token"]).toBe("[REDACTED]");
      expect(result["Content-Type"]).toBe("application/json");
      expect(result["Accept"]).toBe("application/json");
    });
  });

  describe("when headers contain no sensitive data", () => {
    it("returns all headers unchanged", () => {
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "test-agent",
      };
      
      const result = redactHeaders(headers);
      
      expect(result).toEqual(headers);
    });
  });

  describe("when creating header redaction rules", () => {
    it("includes authorization rule", () => {
      const rules = createHeaderRedactionRules();
      const authRule = rules.find(r => r.name === "authorization");
      
      expect(authRule).toBeDefined();
    });

    it("includes api-key rule", () => {
      const rules = createHeaderRedactionRules();
      const apiKeyRule = rules.find(r => r.name === "api_key");
      
      expect(apiKeyRule).toBeDefined();
    });

    it("includes token rule", () => {
      const rules = createHeaderRedactionRules();
      const tokenRule = rules.find(r => r.name === "token");
      
      expect(tokenRule).toBeDefined();
    });
  });

  describe("when headers is not an object", () => {
    it("returns null for null input", () => {
      const result = redactHeaders(null);
      expect(result).toBe(null);
    });

    it("returns undefined for undefined input", () => {
      const result = redactHeaders(undefined);
      expect(result).toBe(undefined);
    });

    it("returns string unchanged", () => {
      const result = redactHeaders("not an object" as any);
      expect(result).toBe("not an object");
    });
  });
});
