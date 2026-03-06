Feature: Trace Sampling and Rate Limiting
  As a developer
  I want to configure trace sampling rates for high-volume agents
  So that I can control costs while maintaining observability

  Background:
    Given the LangWatch SDK is initialized

  Scenario: Configure sampling rate within valid range
    When I configure sampling rate to 0.5
    Then the configuration is accepted
    And approximately 50% of traces are sampled

  Scenario: Reject sampling rate below 0.0
    When I configure sampling rate to -0.1
    Then a ConfigurationError is thrown
    And the error message contains "samplingRate must be between 0.0 and 1.0"

  Scenario: Reject sampling rate above 1.0
    When I configure sampling rate to 1.5
    Then a ConfigurationError is thrown
    And the error message contains "samplingRate must be between 0.0 and 1.0"

  Scenario: Head-based sampling decision at trace creation
    Given sampling rate is configured to 0.3
    When a trace is created
    Then the sampling decision is made immediately
    And the decision is consistent for all spans in the trace

  Scenario: All spans in sampled trace are captured
    Given sampling rate is configured to 1.0
    When a trace with 5 nested spans is created
    Then all 5 spans are exported
    And the trace contains all span data

  Scenario: No spans exported for unsampled trace
    Given sampling rate is configured to 0.0
    When a trace with 5 nested spans is created
    Then no spans are exported
    And no trace data is sent to LangWatch

  Scenario: Sampling metadata included in traces
    Given sampling rate is configured to 0.7
    When a sampled trace is created
    Then the trace includes sampling rate metadata
    And the metadata shows samplingRate as 0.7
    And the metadata shows sampled as true

  Scenario: Sampling metadata for unsampled traces
    Given sampling rate is configured to 0.3
    When an unsampled trace is created
    Then the trace includes sampling rate metadata
    And the metadata shows samplingRate as 0.3
    And the metadata shows sampled as false

  Scenario: Metrics adjustment for sampling in analytics
    Given sampling rate is configured to 0.1
    And 100 traces are sampled (10 actual traces captured)
    When calculating total trace count
    Then the estimated total is 100 traces
    And the calculation accounts for the 0.1 sampling rate

  Scenario: Cost metrics scaled for sampling
    Given sampling rate is configured to 0.2
    And sampled traces have total cost of $5
    When calculating estimated total cost
    Then the estimated cost is $25
    And the calculation scales by 1/0.2

  Scenario: Error rate calculation with sampling
    Given sampling rate is configured to 0.5
    And 10 sampled traces with 2 errors
    When calculating error rate
    Then the error rate is 20%
    And the calculation is not affected by sampling rate

  Scenario: Default sampling rate of 1.0
    When no sampling rate is configured
    Then all traces are sampled
    And the effective sampling rate is 1.0
