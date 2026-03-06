Feature: Scenario-Based Agent Testing
  As a developer
  I want to create and execute test scenarios for my Claude Code agent
  So that I can validate agent behavior and catch regressions

  Background:
    Given a Claude Code agent is instrumented with LangWatch SDK
    And the agent has a function that processes user requests

  Scenario: Create a scenario with situation and criteria
    When I create a scenario with:
      | name      | Code generation for sorting algorithm           |
      | situation | User requests a Python function to sort a list  |
      | criteria  | Generated code is syntactically valid Python    |
      | criteria  | Function accepts a list parameter               |
      | criteria  | Function returns a sorted list                  |
      | labels    | code-generation, python                         |
    Then the scenario is stored with a unique ID
    And retrieving the scenario returns the same situation and criteria

  Scenario: Execute a scenario against an agent
    Given a scenario exists with situation "Generate a hello world function"
    And the scenario has criteria "Code is syntactically valid"
    When I execute the scenario against the agent
    Then a trace is created with type "agent_test"
    And the agent receives the situation as input
    And the scenario criteria are evaluated against the output
    And the result includes pass/fail status for each criterion

  Scenario: Execute batch scenarios with parallel execution
    Given 5 scenarios exist in the system
    When I execute a batch test with concurrency 3
    Then the scenarios execute in parallel with max 3 concurrent executions
    And results are collected from all scenario executions
    And each result includes trace_id, passed status, and execution time

  Scenario: Generate scenario test report
    Given 10 scenarios have been executed
    And 7 scenarios passed
    And 3 scenarios failed
    When I generate a scenario report
    Then the report shows:
      | total      | 10   |
      | passed     | 7    |
      | failed     | 3    |
      | pass_rate  | 70%  |
    And the report includes individual test case results with details

  Scenario: Run evaluators on batch test results
    Given a batch test with 5 scenarios
    And 2 evaluators are configured: "code-correctness" and "response-accuracy"
    When I execute the batch test
    Then each evaluator runs on each test case result
    And evaluation scores are aggregated across all test cases
    And the report includes aggregate scores per evaluator

  Scenario: Scenario execution with timeout
    Given a scenario with a 5 second timeout
    When the agent takes longer than 5 seconds to respond
    Then the scenario execution fails with timeout error
    And the result includes error details

  Scenario: Scenario execution with agent error
    Given a scenario exists
    When the agent throws an error during execution
    Then the scenario execution fails
    And the error is captured in the result
    And the trace is marked with error status
