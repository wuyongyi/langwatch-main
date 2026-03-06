Feature: Data Redaction and Security for Agent Instrumentation

  As a developer using Claude Code agents
  I want sensitive data automatically redacted from traces
  So that I maintain security and compliance without manual intervention

  Background:
    Given the LangWatch observability SDK is initialized
    And I have an active trace context

  Scenario: Redact Authorization header from HTTP request span
    Given I create a span with HTTP request data
    And the request includes an Authorization header with value "Bearer secret-token-12345"
    When the span is exported
    Then the Authorization header value is redacted to "[REDACTED]"
    And other headers remain unchanged

  Scenario: Redact API key header from HTTP request span
    Given I create a span with HTTP request data
    And the request includes an x-api-key header with value "sk-1234567890abcdef"
    When the span is exported
    Then the x-api-key header value is redacted to "[REDACTED]"
    And other headers remain unchanged

  Scenario: Redact multiple sensitive headers
    Given I create a span with HTTP request data
    And the request includes an Authorization header
    And the request includes an x-api-key header
    And the request includes a custom-token header
    When the span is exported
    Then all sensitive headers are redacted
    And non-sensitive headers remain unchanged

  Scenario: Redact API key pattern in span input
    Given I create a span with input containing "My API key is sk-1234567890abcdef"
    When the span is exported
    Then the input is redacted to "My API key is sk-***REDACTED***"

  Scenario: Redact Bearer token pattern in span output
    Given I create a span with output containing "Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    When the span is exported
    Then the output is redacted to "Token: Bearer ***REDACTED***"

  Scenario: Redact password pattern in span data
    Given I create a span with input containing "password=mySecretPass123"
    When the span is exported
    Then the input is redacted to "password=***REDACTED***"

  Scenario: Apply multiple redaction rules to same span
    Given I create a span with input containing an API key and a password
    When the span is exported
    Then both the API key and password are redacted
    And the rest of the text remains unchanged

  Scenario: Redaction does not affect non-sensitive data
    Given I create a span with input "Hello world, this is normal text"
    When the span is exported
    Then the input remains "Hello world, this is normal text"

  Scenario: Custom redaction rule for domain-specific secrets
    Given I configure a custom redaction rule for pattern "secret-key-[a-z0-9]+"
    And I create a span with input containing "secret-key-abc123"
    When the span is exported
    Then the input is redacted to "***REDACTED***"

  Scenario: Attach custom string metadata to trace
    Given I have an active trace
    When I attach metadata with key "environment" and value "production"
    Then the trace includes metadata "environment" with value "production"

  Scenario: Attach custom number metadata to trace
    Given I have an active trace
    When I attach metadata with key "retry_count" and value 3
    Then the trace includes metadata "retry_count" with value 3

  Scenario: Attach custom boolean metadata to trace
    Given I have an active trace
    When I attach metadata with key "is_test" and value true
    Then the trace includes metadata "is_test" with value true

  Scenario: Attach custom array metadata to trace
    Given I have an active trace
    When I attach metadata with key "tags" and value ["urgent", "customer-facing"]
    Then the trace includes metadata "tags" with value ["urgent", "customer-facing"]

  Scenario: Attach multiple custom metadata fields to trace
    Given I have an active trace
    When I attach metadata "environment" with value "production"
    And I attach metadata "version" with value "1.2.3"
    And I attach metadata "region" with value "us-east-1"
    Then the trace includes all three metadata fields with correct values

  Scenario: Attach custom metadata to span
    Given I have an active span
    When I attach metadata with key "skill_type" and value "code_generation"
    Then the span includes metadata "skill_type" with value "code_generation"

  Scenario: Attach multiple metadata types to span
    Given I have an active span
    When I attach string metadata "operation" with value "query"
    And I attach number metadata "timeout_ms" with value 5000
    And I attach boolean metadata "cached" with value false
    Then the span includes all metadata with correct types and values

  Scenario: Metadata survives redaction process
    Given I have an active span with custom metadata
    And the span input contains sensitive data
    When the span is exported
    Then the sensitive data is redacted
    And the custom metadata remains intact

  Scenario: Search traces by custom metadata
    Given I have created traces with custom metadata "environment" set to "production"
    And I have created traces with custom metadata "environment" set to "staging"
    When I search for traces with metadata filter "environment" equals "production"
    Then only traces with "environment" set to "production" are returned

  Scenario: Redaction preserves trace structure
    Given I have a trace with nested spans
    And some spans contain sensitive data
    When the trace is exported
    Then the sensitive data is redacted
    And the parent-child span relationships remain intact
    And span IDs and trace IDs are unchanged
