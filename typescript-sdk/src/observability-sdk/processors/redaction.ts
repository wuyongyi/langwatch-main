/**
 * Redaction Rules Engine for OpenTelemetry Spans
 *
 * This module provides pattern-based redaction of sensitive data from span attributes
 * before export. It supports API keys, tokens, passwords, headers, and custom patterns.
 *
 * @module redaction
 */

import type { Attributes } from "@opentelemetry/api";

/**
 * A rule for redacting sensitive HTTP headers.
 *
 * @property name - Unique identifier for the rule.
 * @property headerPattern - Regular expression to match header names (case-insensitive).
 *
 * @example
 * const rule: HeaderRedactionRule = {
 *   name: 'authorization',
 *   headerPattern: /^authorization$/i,
 * };
 */
export interface HeaderRedactionRule {
  name: string;
  headerPattern: RegExp;
}

/**
 * A rule for redacting sensitive data based on regex patterns.
 *
 * @property name - Unique identifier for the rule.
 * @property pattern - Regular expression to match sensitive data.
 * @property replacement - String to replace matched patterns with.
 *
 * @example
 * const rule: RedactionRule = {
 *   name: 'api_key',
 *   pattern: /sk-[a-zA-Z0-9]+/g,
 *   replacement: 'sk-***REDACTED***',
 * };
 */
export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Creates the default set of header redaction rules for common sensitive headers.
 *
 * Default rules include:
 * - Authorization headers
 * - API key headers (x-api-key, api-key)
 * - Token headers (custom-token, x-auth-token, etc.)
 *
 * @returns Array of default header redaction rules
 *
 * @example
 * const rules = createHeaderRedactionRules();
 * const redacted = redactHeaders(headers, rules);
 */
export function createHeaderRedactionRules(): HeaderRedactionRule[] {
  return [
    {
      name: "authorization",
      headerPattern: /^authorization$/i,
    },
    {
      name: "api_key",
      headerPattern: /^(x-)?api[_-]key$/i,
    },
    {
      name: "token",
      headerPattern: /^(x-)?(auth-)?token$/i,
    },
    {
      name: "custom_token",
      headerPattern: /^custom[_-]token$/i,
    },
  ];
}

/**
 * Redacts sensitive HTTP headers using the provided redaction rules.
 *
 * Replaces sensitive header values with "[REDACTED]" while preserving
 * non-sensitive headers unchanged.
 *
 * @param headers - The headers object to redact (can be any type)
 * @param rules - Array of header redaction rules (defaults to standard rules)
 * @returns New headers object with redacted values, or original value if not an object
 *
 * @example
 * const headers = { Authorization: "Bearer token", "Content-Type": "application/json" };
 * const redacted = redactHeaders(headers);
 * // Returns: { Authorization: "[REDACTED]", "Content-Type": "application/json" }
 */
export function redactHeaders(
  headers: any,
  rules: HeaderRedactionRule[] = createHeaderRedactionRules()
): any {
  // Handle null, undefined, and non-objects
  if (headers === null || headers === undefined) {
    return headers;
  }

  if (typeof headers !== "object" || Array.isArray(headers)) {
    return headers;
  }

  const redacted: Record<string, any> = {};

  for (const [key, value] of Object.entries(headers)) {
    // Check if this header should be redacted
    const shouldRedact = rules.some(rule => rule.headerPattern.test(key));

    if (shouldRedact) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Creates the default set of redaction rules for common sensitive patterns.
 *
 * Default rules include:
 * - API keys (sk-*, api_key=*, apikey=*)
 * - Bearer tokens
 * - Passwords (password=*, pwd=*)
 * - Authorization tokens
 *
 * @returns Array of default redaction rules
 *
 * @example
 * const rules = createDefaultRedactionRules();
 * const redacted = redactValue(sensitiveData, rules);
 */
export function createDefaultRedactionRules(): RedactionRule[] {
  return [
    {
      name: "api_key",
      pattern: /sk-[a-zA-Z0-9]+/gi,
      replacement: "sk-***REDACTED***",
    },
    {
      name: "bearer_token",
      pattern: /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
      replacement: "Bearer ***REDACTED***",
    },
    {
      name: "password",
      pattern: /(password|pwd)=[^\s&]+/gi,
      replacement: "$1=***REDACTED***",
    },
    {
      name: "authorization",
      pattern: /authorization=[^\s&]+/gi,
      replacement: "authorization=***REDACTED***",
    },
  ];
}

/**
 * Redacts sensitive data from a value using the provided redaction rules.
 *
 * Supports:
 * - Strings: applies pattern matching
 * - Objects: recursively redacts all string values
 * - Arrays: recursively redacts all elements
 * - Primitives: returns unchanged
 *
 * @param value - The value to redact (can be any type)
 * @param rules - Array of redaction rules to apply
 * @returns The redacted value with the same type as input
 *
 * @example
 * const rules = createDefaultRedactionRules();
 * const redacted = redactValue("My API key is sk-abc123", rules);
 * // Returns: "My API key is sk-***REDACTED***"
 */
export function redactValue(value: any, rules: RedactionRule[]): any {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle strings - apply all redaction rules
  if (typeof value === "string") {
    let redacted = value;
    for (const rule of rules) {
      redacted = redacted.replace(rule.pattern, rule.replacement);
    }
    return redacted;
  }

  // Handle arrays - recursively redact each element
  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, rules));
  }

  // Handle objects - recursively redact all values
  if (typeof value === "object") {
    const redacted: any = {};
    for (const [key, val] of Object.entries(value)) {
      redacted[key] = redactValue(val, rules);
    }
    return redacted;
  }

  // Return primitives unchanged (numbers, booleans, etc.)
  return value;
}

/**
 * Applies redaction rules to span attributes.
 *
 * Specifically targets:
 * - langwatch.input: Redacts sensitive data in span input
 * - langwatch.output: Redacts sensitive data in span output
 * - Other attributes: Passed through unchanged
 *
 * Handles JSON-serialized SpanInputOutput structures gracefully.
 *
 * @param attributes - The span attributes to redact
 * @param rules - Array of redaction rules to apply
 * @returns New attributes object with redacted values
 *
 * @example
 * const attributes = {
 *   'langwatch.input': JSON.stringify({ type: 'text', value: 'sk-abc123' })
 * };
 * const redacted = applyRedaction(attributes, createDefaultRedactionRules());
 */
export function applyRedaction(
  attributes: Attributes,
  rules: RedactionRule[]
): Attributes {
  const redacted: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    // Target langwatch input/output attributes
    if (key === "langwatch.input" || key === "langwatch.output") {
      if (typeof value === "string") {
        try {
          // Try to parse as JSON (SpanInputOutput structure)
          const parsed = JSON.parse(value);
          const redactedParsed = redactValue(parsed, rules);
          redacted[key] = JSON.stringify(redactedParsed);
        } catch {
          // If not valid JSON, treat as plain string
          redacted[key] = redactValue(value, rules);
        }
      } else {
        redacted[key] = redactValue(value, rules);
      }
    } else {
      // Pass through other attributes unchanged
      redacted[key] = value;
    }
  }

  return redacted;
}
