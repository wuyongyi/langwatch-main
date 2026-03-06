@integration
Feature: Programmatic Trace Creation via MCP
  As a Claude Code agent
  I want to create traces and spans programmatically via MCP tools
  So that I can instrument my execution without using the SDK

  Background:
    Given the MCP server is configured with a valid API key
    And the LangWatch project exists

  Scenario: Agent creates a new trace
    When the agent calls create_trace with:
      | name     | agent-execution        |
      | input    | User request text      |
      | user_id  | user-123               |
      | thread_id| thread-456             |
    Then the response contains a trace_id
    And the trace is stored in LangWatch
    And the trace has the provided input and metadata

  Scenario: Agent adds a span to an existing trace
    Given a trace exists with id "trace-abc-123"
    When the agent calls add_span with:
      | trace_id | trace-abc-123          |
      | name     | skill-execution        |
      | type     | agent_skill            |
      | input    | Skill input            |
      | output   | Skill output           |
    Then the response confirms span creation
    And the span is nested under the trace
    And the span has the provided attributes

  Scenario: Agent adds a nested span with parent
    Given a trace exists with id "trace-abc-123"
    And a span exists with id "span-parent-456"
    When the agent calls add_span with:
      | trace_id      | trace-abc-123     |
      | parent_span_id| span-parent-456   |
      | name          | nested-operation  |
      | type          | tool              |
    Then the span is created as a child of the parent span
    And the span hierarchy is preserved

  Scenario: Agent records an evaluation on a trace
    Given a trace exists with id "trace-abc-123"
    When the agent calls record_evaluation with:
      | trace_id       | trace-abc-123        |
      | evaluator_name | code-correctness     |
      | passed         | true                 |
      | score          | 0.95                 |
      | details        | Code compiles        |
    Then the evaluation is attached to the trace
    And retrieving the trace includes the evaluation

  Scenario: Agent attempts to add span to non-existent trace
    When the agent calls add_span with:
      | trace_id | nonexistent-trace |
      | name     | test-span         |
      | type     | agent_skill       |
    Then the response contains an error "Trace not found"

  Scenario: Agent creates trace with minimal required fields
    When the agent calls create_trace with:
      | name  | minimal-trace |
      | input | Test input    |
    Then the response contains a trace_id
    And the trace is created successfully
    And optional metadata fields are empty
