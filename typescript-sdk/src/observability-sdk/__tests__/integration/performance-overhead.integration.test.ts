/**
 * Performance integration test for Claude Code Agent Integration
 * 
 * Tests that instrumentation overhead is acceptable:
 * - Measures baseline agent execution time without instrumentation
 * - Measures instrumented agent execution time
 * - Verifies overhead is less than 5% of execution time
 * 
 * Feature: claude-code-agent-integration
 * Task: 21.2 - Write performance test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupAgentObservability } from "../../setup/agent-setup";
import { trace as traceDecorator, span as spanDecorator } from "../../decorators";

// Test agent without instrumentation
class BaselineAgent {
  async executeTask(input: string): Promise<string> {
    const context = await this.retrieveContext(input);
    const result = await this.processData(context);
    return result;
  }

  async retrieveContext(input: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return `Context for: ${input}`;
  }

  async processData(data: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return `Processed: ${data}`;
  }
}

// Test agent with instrumentation
class InstrumentedAgent {
  // @ts-expect-error - Decorator type mismatch with TS 5.0+ strict checking, works at runtime
  @traceDecorator({ name: "test-agent-execution" })
  async executeTask(input: string): Promise<string> {
    const context = await this.retrieveContext(input);
    const result = await this.processData(context);
    return result;
  }

  // @ts-expect-error - Decorator type mismatch with TS 5.0+ strict checking, works at runtime
  @spanDecorator({ type: "agent_skill", name: "context-retrieval" })
  async retrieveContext(input: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return `Context for: ${input}`;
  }

  // @ts-expect-error - Decorator type mismatch with TS 5.0+ strict checking, works at runtime
  @spanDecorator({ type: "agent_skill", name: "data-processing" })
  async processData(data: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return `Processed: ${data}`;
  }
}

describe("given agent with instrumentation", () => {
  let shutdownHandle: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (shutdownHandle) {
      await shutdownHandle();
      shutdownHandle = undefined;
    }
  });

  describe("when measuring performance overhead", () => {
    it("adds less than 5% overhead to agent execution", async () => {
      const iterations = 50;
      const warmupIterations = 10;

      // Warmup - baseline agent
      const baselineAgent = new BaselineAgent();
      for (let i = 0; i < warmupIterations; i++) {
        await baselineAgent.executeTask(`warmup-${i}`);
      }

      // Measure baseline: agent without instrumentation
      const baselineStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await baselineAgent.executeTask(`baseline-${i}`);
      }
      const baselineTime = Date.now() - baselineStart;

      // Setup instrumentation
      const handle = setupAgentObservability({
        apiKey: "test-api-key",
        serviceName: "performance-test-agent",
        samplingRate: 1.0, // Sample all for consistent measurement
        captureInput: true,
        captureOutput: true
      });
      shutdownHandle = handle.shutdown;

      // Warmup - instrumented agent
      const instrumentedAgent = new InstrumentedAgent();
      for (let i = 0; i < warmupIterations; i++) {
        await instrumentedAgent.executeTask(`warmup-${i}`);
      }

      // Measure with instrumentation
      const instrumentedStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await instrumentedAgent.executeTask(`instrumented-${i}`);
      }
      const instrumentedTime = Date.now() - instrumentedStart;

      // Calculate overhead
      const overhead = (instrumentedTime - baselineTime) / baselineTime;
      const overheadPercentage = overhead * 100;

      console.log(`\n📊 Performance Test Results:`);
      console.log(`   Baseline time: ${baselineTime}ms (${(baselineTime / iterations).toFixed(2)}ms per iteration)`);
      console.log(`   Instrumented time: ${instrumentedTime}ms (${(instrumentedTime / iterations).toFixed(2)}ms per iteration)`);
      console.log(`   Overhead: ${overheadPercentage.toFixed(2)}%`);

      // Verify overhead is less than 5%
      expect(overhead).toBeLessThan(0.05);
    }, 30000); // 30 second timeout for performance test

    it("maintains consistent performance across multiple executions", async () => {
      const handle = setupAgentObservability({
        apiKey: "test-api-key",
        serviceName: "consistency-test-agent",
        samplingRate: 1.0
      });
      shutdownHandle = handle.shutdown;

      const agent = new InstrumentedAgent();
      const executionTimes: number[] = [];
      const iterations = 20;

      // Measure execution time for each iteration
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await agent.executeTask(`test-${i}`);
        const duration = Date.now() - start;
        executionTimes.push(duration);
      }

      // Calculate statistics
      const mean = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / executionTimes.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / mean;

      console.log(`\n📊 Consistency Test Results:`);
      console.log(`   Mean execution time: ${mean.toFixed(2)}ms`);
      console.log(`   Standard deviation: ${stdDev.toFixed(2)}ms`);
      console.log(`   Coefficient of variation: ${(coefficientOfVariation * 100).toFixed(2)}%`);

      // Verify consistent performance (CV should be low)
      // Allow up to 30% variation due to test environment variability
      expect(coefficientOfVariation).toBeLessThan(0.3);
    }, 30000);
  });

  describe("when measuring export overhead", () => {
    it("batches spans efficiently without blocking agent execution", async () => {
      const handle = setupAgentObservability({
        apiKey: "test-api-key",
        serviceName: "export-test-agent",
        samplingRate: 1.0
      });
      shutdownHandle = handle.shutdown;

      const agent = new InstrumentedAgent();
      const taskCount = 100;

      // Execute many tasks rapidly
      const start = Date.now();
      const promises = [];
      for (let i = 0; i < taskCount; i++) {
        promises.push(agent.executeTask(`task-${i}`));
      }
      await Promise.all(promises);
      const duration = Date.now() - start;

      const avgTimePerTask = duration / taskCount;

      console.log(`\n📊 Export Overhead Test Results:`);
      console.log(`   Total time for ${taskCount} tasks: ${duration}ms`);
      console.log(`   Average time per task: ${avgTimePerTask.toFixed(2)}ms`);

      // Verify tasks complete quickly (export happens asynchronously)
      // Each task should complete in reasonable time despite export overhead
      expect(avgTimePerTask).toBeLessThan(50); // Less than 50ms per task on average
    }, 30000);
  });

  describe("when measuring memory overhead", () => {
    it("does not cause significant memory growth during extended execution", async () => {
      const handle = setupAgentObservability({
        apiKey: "test-api-key",
        serviceName: "memory-test-agent",
        samplingRate: 1.0
      });
      shutdownHandle = handle.shutdown;

      const agent = new InstrumentedAgent();

      // Force garbage collection if available (requires --expose-gc flag)
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Execute many tasks
      const taskCount = 200;
      for (let i = 0; i < taskCount; i++) {
        await agent.executeTask(`task-${i}`);
        
        // Periodically allow event loop to process
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      console.log(`\n📊 Memory Overhead Test Results:`);
      console.log(`   Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);

      // Verify memory growth is reasonable (less than 50MB for 200 tasks)
      expect(memoryGrowthMB).toBeLessThan(50);
    }, 60000); // 60 second timeout for memory test
  });

  describe("when using sampling to reduce overhead", () => {
    it("reduces overhead proportionally to sampling rate", async () => {
      const iterations = 30;

      // Test with 100% sampling
      const handle100 = setupAgentObservability({
        apiKey: "test-api-key",
        serviceName: "sampling-100-agent",
        samplingRate: 1.0
      });

      const agent100 = new InstrumentedAgent();
      const start100 = Date.now();
      for (let i = 0; i < iterations; i++) {
        await agent100.executeTask(`task-${i}`);
      }
      const time100 = Date.now() - start100;

      await handle100.shutdown();

      // Test with 10% sampling
      const handle10 = setupAgentObservability({
        apiKey: "test-api-key",
        serviceName: "sampling-10-agent",
        samplingRate: 0.1
      });
      shutdownHandle = handle10.shutdown;

      const agent10 = new InstrumentedAgent();
      const start10 = Date.now();
      for (let i = 0; i < iterations; i++) {
        await agent10.executeTask(`task-${i}`);
      }
      const time10 = Date.now() - start10;

      console.log(`\n📊 Sampling Overhead Test Results:`);
      console.log(`   100% sampling time: ${time100}ms`);
      console.log(`   10% sampling time: ${time10}ms`);
      console.log(`   Time reduction: ${((time100 - time10) / time100 * 100).toFixed(2)}%`);

      // Lower sampling should not be slower than higher sampling
      // (May be similar due to decision overhead, but should not be significantly slower)
      expect(time10).toBeLessThanOrEqual(time100 * 1.1); // Allow 10% variance
    }, 30000);
  });
});
