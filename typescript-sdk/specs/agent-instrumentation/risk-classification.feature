Feature: Risk Classification for Agent Operations
  As a developer
  I want to classify agent operations by risk level
  So that I can prioritize monitoring and incident response for critical operations

  Background:
    Given the LangWatch observability SDK is initialized

  Scenario: Manual risk level tagging on trace
    Given an active trace for an agent operation
    When I tag the trace with risk level "high"
    Then the trace has attribute "langwatch.risk.level" set to "high"

  Scenario: Manual risk level tagging with reason
    Given an active trace for an agent operation
    When I tag the trace with risk level "high" and reason "Modifying production database"
    Then the trace has attribute "langwatch.risk.level" set to "high"
    And the trace has attribute "langwatch.risk.reason" set to "Modifying production database"

  Scenario: Automatic risk classification for delete operations
    Given an operation name "delete_user_account"
    When I classify the operation automatically
    Then the risk level is "high"

  Scenario: Automatic risk classification for drop operations
    Given an operation name "drop_table"
    When I classify the operation automatically
    Then the risk level is "high"

  Scenario: Automatic risk classification for update operations
    Given an operation name "update_user_profile"
    When I classify the operation automatically
    Then the risk level is "medium"

  Scenario: Automatic risk classification for modify operations
    Given an operation name "modify_settings"
    When I classify the operation automatically
    Then the risk level is "medium"

  Scenario: Automatic risk classification for safe operations
    Given an operation name "get_user_profile"
    When I classify the operation automatically
    Then the risk level is "low"

  Scenario: Automatic risk classification with context
    Given an operation name "execute_query"
    And operation context with "query" containing "DROP TABLE"
    When I classify the operation with context
    Then the risk level is "high"

  Scenario: Risk level validation rejects invalid values
    Given an active trace for an agent operation
    When I attempt to tag the trace with risk level "critical"
    Then an error is thrown indicating invalid risk level

  Scenario: Retrieving trace preserves risk level
    Given a trace tagged with risk level "high"
    When I retrieve the trace by its trace ID
    Then the retrieved trace has risk level "high"
