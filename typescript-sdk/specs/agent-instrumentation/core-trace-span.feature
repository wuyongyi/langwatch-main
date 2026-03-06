Feature: Core Trace and Span Creation for Agent Instrumentation

  As a developer using Claude Code agents
  I want to instrument my agent with automatic trace and span creation
  So that I can monitor agent execution in LangWatch

  Background:
    Given the LangWatch observability SDK is available
    And OpenTelemetry dependencies are installed

  Scenario: Initialize observability with valid configuration
    Given I have a valid LangWatch API key
    When I call setupObservability with serviceName "test-agent" and the API key
    Then the TracerProvider is initialized
    And the API key is validated
    And the service name is set to "test-agent"

  Scenario: Initialize observability with environment variable API key
    Given the LANGWATCH_API_KEY environment variable is set
    When I call setupObservability with serviceName "test-agent"
    Then the TracerProvider is initialized using the environment variable API key

  Scenario: Fail initialization with missing API key
    Given no API key is provided
    And the LANGWATCH_API_KEY environment variable is not set
    When I call setupObservability with serviceName "test-agent"
    Then a ConfigurationError is thrown with message "API key is required"

  Scenario: Create root trace with @trace decorator
    Given observability is initialized
    And I have a function decorated with @trace
    When I call the decorated function with input "test input"
    Then a root trace is created with a unique trace ID
    And the trace captures the function input
    And the trace captures the function output
    And the trace has a completion status

  Scenario: Create root trace with metadata
    Given observability is initialized
    And I have a function decorated with @trace
    When I call the decorated function with metadata user_id "user123" and thread_id "thread456"
    Then a root trace is created
    And the trace metadata includes user_id "user123"
    And the trace metadata includes thread_id "thread456"

  Scenario: Handle async functions in @trace decorator
    Given observability is initialized
    And I have an async function decorated with @trace
    When I call the decorated async function
    Then a root trace is created
    And the trace waits for the async function to complete
    And the trace captures the resolved output

  Scenario: Create nested span with @span decorator
    Given observability is initialized
    And I have a function decorated with @span
    And there is an active trace context
    When I call the decorated function
    Then a span is created nested under the active trace
    And the span has a parent_id pointing to the active span
    And the span type is set to "agent_skill"

  Scenario: Capture span input and output
    Given observability is initialized
    And I have a function decorated with @span
    And there is an active trace context
    When I call the decorated function with input "skill input"
    And the function returns "skill output"
    Then the span captures input "skill input"
    And the span captures output "skill output"

  Scenario: Maintain proper span hierarchy
    Given observability is initialized
    And I have nested functions decorated with @span
    When I call the outer function which calls the inner function
    Then the outer span is created first
    And the inner span is created with parent_id pointing to the outer span
    And the span hierarchy reflects the call stack

  Scenario: Capture error in span
    Given observability is initialized
    And I have a function decorated with @span that throws an error
    And there is an active trace context
    When I call the decorated function
    Then the span captures the error status
    And the span captures the error message
    And the span captures the stack trace
    And the trace is marked with error status

  Scenario: Handle async functions in @span decorator
    Given observability is initialized
    And I have an async function decorated with @span
    And there is an active trace context
    When I call the decorated async function
    Then a span is created
    And the span waits for the async function to complete
    And the span captures the resolved output

  Scenario: Create trace without decorator using tracer API
    Given observability is initialized
    When I get a tracer with name "manual-tracer"
    And I call withActiveSpan with name "manual-operation"
    Then a span is created with name "manual-operation"
    And the span is automatically ended when the callback completes

  Scenario: Propagate context across async operations
    Given observability is initialized
    And I have nested async operations
    When I create a span in the parent operation
    And I create a span in the child async operation
    Then the child span has parent_id pointing to the parent span
    And the OpenTelemetry context is propagated correctly
