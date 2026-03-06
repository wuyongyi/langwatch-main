# Implementation Plan: Claude Code Agent Integration

## Overview

This implementation plan breaks down the Claude Code Agent Integration feature into discrete coding tasks. The feature adds comprehensive observability, evaluation, and testing capabilities for Claude Code agents through SDK instrumentation, MCP server extensions, and automated evaluation frameworks.

The implementation follows an incremental approach: core instrumentation → MCP extensions → evaluation framework → scenario testing → risk assessment → documentation and testing.

## Tasks

- [x] 1. Set up project structure and core dependencies
  - Create directory structure for SDK instrumentation layer
  - Add OpenTelemetry dependencies (@opentelemetry/api, @opentelemetry/sdk-trace-base, @opentelemetry/exporter-trace-otlp-http)
  - Add fast-check for property-based testing
  - Set up TypeScript configuration for new modules
  - _Requirements: 4.1, 6.1_

- [x] 2. Implement core trace and span creation
  - [x] 2.1 Create tracer initialization and configuration
    - Implement `setupObservability()` function with AgentInstrumentationConfig interface
    - Create TracerProvider with LangWatch-specific configuration
    - Implement API key validation and environment variable reading
    - _Requirements: 4.1, 16.1, 16.2_
  
  - [x] 2.2 Implement trace decorator (@langwatch.trace)
    - Create decorator that wraps functions to create root traces
    - Capture function input as trace input
    - Capture function output as trace output
    - Set trace metadata (user_id, thread_id, task_type)
    - Handle async functions properly
    - _Requirements: 1.1, 1.2, 1.3, 4.2_
  
  - [ ]* 2.3 Write property test for trace decorator
    - **Property 1: Unique Trace ID Generation**
    - **Property 2: Trace Data Completeness**
    - **Property 3: Trace Metadata Structure**
    - **Property 12: Trace Decorator Functionality**
    - **Validates: Requirements 1.1, 1.2, 1.3, 4.2**
  
  - [x] 2.4 Implement span decorator (@langwatch.span)
    - Create decorator that wraps functions to create nested spans
    - Set span type to "agent_skill" for skill executions
    - Capture span input and output
    - Maintain proper parent-child relationships using OpenTelemetry context
    - _Requirements: 2.1, 2.2, 2.3, 4.3_
  
  - [ ]* 2.5 Write property test for span decorator
    - **Property 5: Nested Span Creation**
    - **Property 6: Span Type Classification**
    - **Property 11: Span Duration Recording**
    - **Property 13: Span Decorator Functionality**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.3**
  
  - [x] 2.6 Implement error capture in spans
    - Wrap span execution in try-catch to capture errors
    - Record error status, message, and stack trace on span
    - Mark trace with error status when any span fails
    - _Requirements: 2.5, 3.5, 10.1_
  
  - [ ]* 2.7 Write property test for error capture
    - **Property 7: Error Capture in Spans**
    - **Validates: Requirements 2.5, 3.5, 10.1**

- [x] 3. Checkpoint - Verify core instrumentation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Claude API auto-instrumentation
  - [x] 4.1 Create Claude client wrapper
    - Implement `instrumentClaudeClient()` function
    - Wrap Anthropic client methods to create LLM spans automatically
    - Capture model name, messages, and parameters
    - _Requirements: 3.1, 4.4_
  
  - [x] 4.2 Implement LLM span data capture
    - Extract prompt tokens, completion tokens from API response
    - Calculate cost based on model pricing
    - Record API latency in milliseconds
    - Capture request messages and response content
    - _Requirements: 3.2, 3.3, 3.4, 9.1_
  
  - [ ]* 4.3 Write property test for Claude API instrumentation
    - **Property 8: LLM Span Creation**
    - **Property 9: LLM Span Metrics Completeness**
    - **Property 10: LLM Span Content Capture**
    - **Property 14: Auto-instrumentation of Claude Client**
    - **Property 20: OpenTelemetry Semantic Conventions**
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.4, 6.2**
  
  - [x] 4.4 Implement cost calculation logic
    - Create model pricing lookup table
    - Calculate cost: (prompt_tokens × prompt_price + completion_tokens × completion_price)
    - Add cost as span attribute
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 4.5 Write property test for cost calculation
    - **Property 30: Cost Calculation Correctness**
    - **Validates: Requirements 9.2**

- [x] 5. Implement OpenTelemetry integration
  - [x] 5.1 Create OTLP exporter with LangWatch endpoint
    - Implement LangWatchExporter extending OTLP HTTP exporter
    - Configure default endpoint: https://app.langwatch.ai/api/otel/v1/traces
    - Add API key to request headers
    - Support custom endpoint configuration
    - _Requirements: 6.1, 6.3_
  
  - [x] 5.2 Implement batch span processor
    - Configure BatchSpanProcessor with appropriate queue sizes
    - Set export batch size and delay parameters
    - Implement graceful shutdown
    - _Requirements: 1.4_
  
  - [ ]* 5.3 Write property test for OTLP export
    - **Property 4: Automatic Trace Export**
    - **Property 19: OTLP Format Compliance**
    - **Property 21: Custom Endpoint Configuration**
    - **Validates: Requirements 1.4, 6.1, 6.3**
  
  - [x] 5.4 Implement context propagation for async operations
    - Ensure OpenTelemetry context is propagated across async boundaries
    - Test nested async operations maintain proper span hierarchy
    - _Requirements: 6.4_
  
  - [ ]* 5.5 Write property test for context propagation
    - **Property 22: Async Context Propagation**
    - **Validates: Requirements 6.4**
  
  - [x] 5.6 Implement TracerProvider reuse logic
    - Check for existing OpenTelemetry TracerProvider
    - Reuse existing provider if available
    - Only create new provider if none exists
    - _Requirements: 6.5_
  
  - [ ]* 5.7 Write unit test for TracerProvider reuse
    - **Property 23: TracerProvider Reuse**
    - **Validates: Requirements 6.5**

- [x] 6. Checkpoint - Verify OpenTelemetry integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement data redaction and security
  - [x] 7.1 Create redaction rules engine
    - Implement pattern matching for sensitive data (API keys, tokens, passwords)
    - Create redaction rule interface
    - Apply redaction to span input/output before export
    - _Requirements: 16.3, 16.4_
  
  - [x] 7.2 Implement automatic header redaction
    - Redact Authorization headers from HTTP request spans
    - Redact API key headers (x-api-key, etc.)
    - _Requirements: 16.3_
  
  - [ ]* 7.3 Write property test for redaction
    - **Property 37: Authorization Header Redaction**
    - **Property 38: API Key Redaction**
    - **Validates: Requirements 16.3, 16.4**
  
  - [x] 7.4 Implement custom metadata attachment
    - Add methods to attach custom key-value metadata to traces
    - Add methods to attach custom key-value metadata to spans
    - Support string, number, boolean, and array value types
    - _Requirements: 4.5, 14.1, 14.2, 14.3_
  
  - [ ]* 7.5 Write property test for metadata handling
    - **Property 15: Metadata Round-Trip**
    - **Property 35: User ID Preservation**
    - **Property 36: Thread ID Preservation**
    - **Validates: Requirements 4.5, 13.1, 13.2, 14.1, 14.2, 14.3**

- [x] 8. Implement MCP server extensions
  - [x] 8.1 Create create_trace MCP tool **[COMPLETE - OTLP Wrapper]**
    - Define tool schema with name, input, metadata parameters
    - Implement tool handler using OpenTelemetry SDK to generate OTLP data
    - Send to existing /api/otel/v1/traces endpoint
    - Return trace_id to agent
    - _Requirements: 5.1_
    - _Status: Implemented at mcp-server/src/tools/create-trace.ts using OTLP wrapper approach_
  
  - [x] 8.2 Create add_span MCP tool **[DEFERRED]**
    - Define tool schema with trace_id, parent_span_id, name, type, input, output, timestamps
    - Implement tool handler that adds span to existing trace
    - Validate trace_id exists before adding span
    - _Requirements: 5.2_
    - _Status: Deferred - Agents should use SDK instrumentation (@langwatch.span decorator) for adding spans, which is the more natural pattern_
  
  - [x] 8.3 Create search_traces MCP tool **[COMPLETE]**
    - Define tool schema with filters, date range, page size
    - Implement tool handler that queries LangWatch API
    - Return matching traces with metadata
    - _Requirements: 5.3_
    - _Status: Already implemented at mcp-server/src/tools/search-traces.ts_
  
  - [x] 8.4 Create get_trace MCP tool **[COMPLETE]**
    - Define tool schema with trace_id parameter
    - Implement tool handler that retrieves trace details
    - Return complete trace with all spans
    - _Requirements: 5.4_
    - _Status: Already implemented at mcp-server/src/tools/get-trace.ts_
  
  - [x] 8.5 Create record_evaluation MCP tool **[COMPLETE - OTLP Wrapper]**
    - Define tool schema with trace_id, evaluator_name, passed, score, details
    - Implement tool handler using OpenTelemetry SDK to create evaluation span
    - Send to existing /api/otel/v1/traces endpoint
    - _Requirements: 5.5_
    - _Status: Implemented at mcp-server/src/tools/record-evaluation.ts using OTLP wrapper approach_
  
  - [ ]* 8.6 Write integration test for MCP tools **[PARTIAL]**
    - **Property 16: MCP Trace Retrieval Round-Trip**
    - **Property 17: Search Filter Correctness**
    - **Property 18: Evaluation Attachment**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
    - _Status: Placeholder tests exist in typescript-sdk/src/observability-sdk/__tests__/integration/mcp-tools.integration.test.ts - need real MCP server integration_
  
  - [x] 8.7 Register MCP tools with existing MCP server **[COMPLETE]**
    - Add new tools to MCP server tool registry
    - Update MCP server documentation with new tools
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
    - _Status: All tools (create_trace, record_evaluation, search_traces, get_trace) registered in mcp-server/src/index.ts_

- [x] 9. Checkpoint - Verify MCP integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement evaluation framework
  - [x] 10.1 Create evaluator interface and registration
    - Define CustomEvaluator interface with evaluate method
    - Implement evaluator registry for custom evaluators
    - Create `registerEvaluator()` function
    - _Requirements: 7.1_
  
  - [x] 10.2 Implement automatic evaluator execution
    - Hook into trace completion event
    - Run all configured evaluators on trace output
    - Record evaluation results with pass/fail and scores
    - _Requirements: 7.3_
  
  - [ ]* 10.3 Write property test for evaluator execution
    - **Property 24: Automatic Evaluator Execution**
    - **Property 25: Evaluation Result Structure**
    - **Validates: Requirements 7.3, 7.4**
  
  - [x] 10.4 Implement built-in code correctness evaluator
    - Check if generated code is syntactically valid
    - Verify code follows language conventions
    - Detect common security issues (SQL injection, XSS, etc.)
    - _Requirements: 7.2_
  
  - [x] 10.5 Implement built-in response accuracy evaluator
    - Use LLM-as-judge pattern to assess answer quality
    - Compare against expected output patterns
    - Detect hallucinations and factual errors
    - _Requirements: 7.2_
  
  - [x] 10.6 Implement built-in task completion evaluator
    - Verify agent completed the requested task
    - Check for partial or incomplete responses
    - Validate output format matches requirements
    - _Requirements: 7.2_
  
  - [x] 10.7 Write unit tests for built-in evaluators
    - Test code correctness evaluator with valid/invalid code
    - Test response accuracy evaluator with correct/incorrect responses
    - Test task completion evaluator with complete/incomplete outputs
    - _Requirements: 7.2_
    - _Status: Tests implemented at typescript-sdk/src/observability-sdk/evaluation/__tests__/unit/_
  
  - [x] 10.8 Implement evaluation result display
    - Add evaluation results to trace detail API response
    - Include evaluator name, passed status, score, and details
    - _Requirements: 7.5_

- [x] 11. Implement scenario testing system
  - [x] 11.1 Create scenario data model and storage
    - Define Scenario interface with id, name, situation, criteria, labels
    - Implement scenario creation API endpoint
    - Store scenarios in database
    - _Requirements: 8.1_
  
  - [ ]* 11.2 Write property test for scenario creation
    - **Property 26: Scenario Creation Round-Trip**
    - **Validates: Requirements 8.1**
  
  - [x] 11.3 Implement scenario execution engine
    - Create `scenarios.execute()` function
    - Execute agent with scenario situation as input
    - Create trace with type "agent_test"
    - Evaluate output against scenario criteria
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ]* 11.4 Write property test for scenario execution
    - **Property 27: Scenario Execution Trace Creation**
    - **Property 28: Scenario Criteria Evaluation**
    - **Validates: Requirements 8.3, 8.4**
  
  - [x] 11.5 Implement batch scenario testing
    - Create `scenarios.executeBatch()` function
    - Support parallel execution with configurable concurrency
    - Collect results from all scenario executions
    - _Requirements: 17.1, 17.2_
  
  - [x] 11.6 Implement scenario report generation
    - Create `scenarios.generateReport()` function
    - Calculate pass rate, total, passed, failed counts
    - Include individual test case results with details
    - _Requirements: 8.5, 17.4_
  
  - [ ]* 11.7 Write property test for scenario reporting
    - **Property 29: Scenario Report Completeness**
    - **Property 41: Batch Report Completeness**
    - **Validates: Requirements 8.5, 17.4**
  
  - [x] 11.8 Implement batch evaluator execution
    - Run configured evaluators on each batch test case result
    - Aggregate evaluation scores across all test cases
    - _Requirements: 17.3_
  
  - [ ]* 11.9 Write property test for batch evaluation
    - **Property 39: Batch Dataset Acceptance**
    - **Property 40: Batch Evaluator Execution**
    - **Validates: Requirements 17.1, 17.2, 17.3**

- [x] 12. Checkpoint - Verify evaluation and scenario testing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement risk assessment system
  - [x] 13.1 Create risk classification logic
    - Implement automatic risk classifier based on operation keywords
    - Support manual risk level tagging (low, medium, high)
    - Add risk level as trace attribute
    - _Requirements: 12.1, 12.2_
  
  - [ ]* 13.2 Write property test for risk classification
    - **Property 32: Risk Level Tagging**
    - **Property 33: Automatic Risk Classification**
    - **Validates: Requirements 12.1, 12.2**
  
  - [x] 13.3 Implement risk-based monitoring
    - Filter traces by risk level in analytics queries
    - Calculate failure rate specifically for high-risk operations
    - Display high-risk operations with success/failure status
    - _Requirements: 12.3, 12.4_
  
  - [x] 13.4 Implement high-risk alert prioritization
    - Mark alerts for high-risk failures with higher priority
    - Include risk level in alert notifications
    - _Requirements: 12.5_
  
  - [ ]* 13.5 Write unit test for risk-based alerting
    - **Property 34: High-Risk Alert Prioritization**
    - **Validates: Requirements 12.5**

- [x] 14. Implement analytics and monitoring
  - [x] 14.1 Create metrics aggregation queries
    - Implement cost aggregation by time period, user, task type
    - Implement token usage aggregation
    - Calculate error rate as percentage of total executions
    - Calculate latency percentiles (p50, p95, p99)
    - _Requirements: 9.3, 9.4, 10.2, 11.2_
  
  - [x] 14.2 Implement error pattern analysis
    - Group errors by error type
    - Count error frequency
    - Identify common error patterns from messages and stack traces
    - _Requirements: 10.3, 10.4_
  
  - [x] 14.3 Implement latency breakdown analysis
    - Calculate latency by skill type
    - Identify slowest operations
    - Display latency trends over time
    - _Requirements: 11.3, 11.4, 11.5_
  
  - [x] 14.4 Implement real-time dashboard metrics
    - Calculate current requests per minute
    - Calculate current error rate
    - Calculate current average latency
    - Display recent traces with status indicators
    - Implement auto-refresh every 30 seconds
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_
  
  - [ ]* 14.5 Write unit tests for analytics queries
    - Test cost aggregation with sample data
    - Test error rate calculation
    - Test latency percentile calculation
    - _Requirements: 9.3, 10.2, 11.2_

- [x] 15. Implement alert system
  - [x] 15.1 Create alert rule configuration
    - Define alert rule interface with condition and threshold
    - Support error rate threshold alerts
    - Support latency threshold alerts
    - Support cost threshold alerts
    - _Requirements: 9.5, 10.5, 19.1, 19.2, 19.3_
  
  - [x] 15.2 Implement alert triggering logic
    - Evaluate alert conditions against current metrics
    - Trigger alerts when thresholds are exceeded
    - _Requirements: 9.5, 10.5, 19.1, 19.2, 19.3_
  
  - [ ]* 15.3 Write property test for alert triggering
    - **Property 31: Threshold Alert Triggering**
    - **Validates: Requirements 9.5, 10.5, 19.1, 19.2, 19.3**
  
  - [x] 15.4 Implement email notification channel
    - Send alert notifications via email
    - Include alert details and relevant metrics
    - _Requirements: 19.4_
  
  - [x] 15.5 Implement webhook notification channel
    - Send alert notifications to configured webhook URLs
    - Format payload with alert details
    - _Requirements: 19.5_
  
  - [ ]* 15.6 Write property test for notification delivery
    - **Property 42: Notification Delivery**
    - **Validates: Requirements 19.4, 19.5**

- [x] 16. Implement trace sampling
  - [x] 16.1 Create sampling configuration
    - Add samplingRate parameter to AgentInstrumentationConfig
    - Validate sampling rate is between 0.0 and 1.0
    - _Requirements: 20.1_
  
  - [x] 16.2 Implement head-based sampling
    - Make sampling decision at trace creation time
    - Use random number generation to determine if trace should be sampled
    - Ensure all spans within sampled trace are captured
    - _Requirements: 20.1, 20.2, 20.3_
  
  - [ ]* 16.3 Write property test for sampling
    - **Property 43: Sampling Rate Adherence**
    - **Property 44: Sampling Consistency**
    - **Validates: Requirements 20.1, 20.2, 20.3**
  
  - [x] 16.4 Add sampling metadata to traces
    - Include sampling rate in trace metadata
    - Mark traces with sampling decision
    - _Requirements: 20.4_
  
  - [ ]* 16.5 Write property test for sampling metadata
    - **Property 45: Sampling Metadata Inclusion**
    - **Validates: Requirements 20.4**
  
  - [x] 16.6 Implement metrics adjustment for sampling
    - Adjust analytics calculations to account for sampling rates
    - Scale up sampled metrics to estimate total population
    - _Requirements: 20.5_

- [x] 17. Checkpoint - Verify analytics, alerts, and sampling
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement error handling and retry logic
  - [x] 18.1 Create error classes
    - Implement InstrumentationError for non-blocking errors
    - Implement ExportError for export failures
    - Implement ConfigurationError for initialization errors
    - _Requirements: Error Handling section_
  
  - [x] 18.2 Implement graceful degradation
    - Queue traces locally when endpoint unavailable
    - Drop oldest traces when queue limit reached (FIFO)
    - Continue agent execution even if tracing fails
    - _Requirements: Error Handling section_
  
  - [x] 18.3 Implement exponential backoff retry
    - Create RetryConfig interface with retry parameters
    - Implement `exportWithRetry()` function
    - Use exponential backoff with max delay cap
    - _Requirements: Error Handling section_
  
  - [ ]* 18.4 Write unit tests for error handling
    - Test graceful degradation when endpoint unavailable
    - Test retry logic with exponential backoff
    - Test queue overflow behavior
    - _Requirements: Error Handling section_

- [x] 19. Create SDK integration documentation
  - [x] 19.1 Write quickstart guide for SDK integration
    - Document installation steps
    - Provide basic setup example with @trace and @span decorators
    - Show Claude API client instrumentation
    - Include complete working example
    - _Requirements: 15.1_
  
  - [x] 19.2 Write MCP integration guide
    - Document MCP server setup
    - Provide examples of using MCP tools from agent code
    - Show how to create traces and spans via MCP
    - _Requirements: 15.2_
  
  - [x] 19.3 Document span types and attributes
    - List all available span types (agent, agent_skill, llm, tool, chain, retriever)
    - Document required attributes for each span type
    - Provide examples for each span type
    - _Requirements: 15.3_
  
  - [x] 19.4 Create instrumentation pattern examples
    - Show common patterns for instrumenting agent skills
    - Provide examples of nested span creation
    - Show error handling patterns
    - _Requirements: 15.4_
  
  - [x] 19.5 Write troubleshooting guide
    - Document common integration issues and solutions
    - Provide debugging tips for missing traces
    - Include FAQ section
    - _Requirements: 15.5_
  
  - [x] 19.6 Document credential management
    - Explain LANGWATCH_API_KEY environment variable
    - Document explicit API key configuration
    - Provide best practices for secret management
    - _Requirements: 16.5_

- [x] 20. Create code examples and demos
  - [x] 20.1 Create basic agent example with SDK instrumentation
    - Build simple Q&A agent with @trace decorator
    - Show skill instrumentation with @span decorator
    - Demonstrate Claude API auto-instrumentation
    - _Requirements: 15.1_
  
  - [x] 20.2 Create code generation agent example
    - Build agent that generates code based on prompts
    - Show evaluation with code correctness evaluator
    - Demonstrate scenario testing
    - _Requirements: 15.1, 15.4_
  
  - [x] 20.3 Create MCP integration example
    - Build agent that uses MCP tools for self-instrumentation
    - Show trace creation and span addition via MCP
    - Demonstrate evaluation recording via MCP
    - _Requirements: 15.2_

- [x] 21. Final integration testing
  - [ ]* 21.1 Write end-to-end integration test
    - Test complete flow: agent execution → trace creation → evaluation → dashboard display
    - Verify all components work together correctly
    - Test with real LangWatch API endpoint
    - _Requirements: All requirements_
  
  - [ ]* 21.2 Write performance test
    - Measure instrumentation overhead
    - Verify overhead is less than 5% of agent execution time
    - Test with various agent workloads
    - _Requirements: Testing Strategy section_
  
  - [ ]* 21.3 Write MCP integration test
    - Test all MCP tools end-to-end
    - Verify trace creation, span addition, search, and evaluation recording
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 22. Final checkpoint - Complete implementation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript as specified in the design document
- All code examples and implementations should follow the patterns shown in the design document
- Testing uses fast-check library for property-based tests with minimum 100 iterations per property
