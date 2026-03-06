/**
 * MCP Integration Example
 * 
 * This example demonstrates:
 * - Using MCP tools to query traces programmatically
 * - Building a self-monitoring agent
 * - Analyzing historical performance
 * - Learning from successful examples
 * 
 * Note: This example shows the patterns for MCP integration.
 * In a real Claude Code agent, the MCP tools would be available
 * through the agent's tool-calling capabilities.
 */

import Anthropic from "@anthropic-ai/sdk";
import { setupObservability } from "langwatch/observability/node";
import { trace, span } from "langwatch/observability";
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";
import { LangWatch } from "langwatch";
import "dotenv/config";

// Initialize LangWatch observability
await setupObservability({
  serviceName: "mcp-integration-agent",
  captureInput: true,
  captureOutput: true
});

// Setup instrumented Claude client
const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Initialize LangWatch client (simulates MCP tool access)
const langwatch = new LangWatch({
  apiKey: process.env.LANGWATCH_API_KEY,
  endpoint: process.env.LANGWATCH_ENDPOINT
});

/**
 * Simulated MCP tool interface
 * In a real Claude Code agent, these would be actual MCP tool calls
 */
class MCPTools {
  /**
   * Search traces using MCP
   */
  async searchTraces(params: {
    filters?: Record<string, string[]>;
    textQuery?: string;
    startDate?: string;
    endDate?: string;
    pageSize?: number;
  }): Promise<any> {
    console.log("🔍 MCP Tool: search_traces", JSON.stringify(params, null, 2));
    
    // In a real agent, this would be:
    // const result = await mcp.call("search_traces", params);
    
    // For this example, we'll simulate the response
    return {
      traces: [
        {
          trace_id: "trace-001",
          input: { value: "Generate a sorting function" },
          output: { value: "def sort_list(items): return sorted(items)" },
          timestamps: { started_at: Date.now() - 3600000 },
          error: null,
          metrics: { total_cost: 0.0045, completion_time_ms: 2500 }
        },
        {
          trace_id: "trace-002",
          input: { value: "Create a string reversal function" },
          output: { value: "def reverse_string(s): return s[::-1]" },
          timestamps: { started_at: Date.now() - 7200000 },
          error: null,
          metrics: { total_cost: 0.0032, completion_time_ms: 1800 }
        }
      ],
      total: 2
    };
  }

  /**
   * Get trace details using MCP
   */
  async getTrace(traceId: string, format: "digest" | "json" = "digest"): Promise<any> {
    console.log(`🔍 MCP Tool: get_trace (${traceId}, format: ${format})`);
    
    // In a real agent, this would be:
    // const result = await mcp.call("get_trace", { traceId, format });
    
    return {
      trace_id: traceId,
      input: { value: "Generate a sorting function" },
      output: { value: "def sort_list(items): return sorted(items)" },
      spans: [
        {
          span_id: "span-001",
          name: "requirement-parsing",
          type: "agent_skill",
          timestamps: { started_at: Date.now() - 3600000, finished_at: Date.now() - 3599850 }
        },
        {
          span_id: "span-002",
          name: "code-synthesis",
          type: "agent_skill",
          timestamps: { started_at: Date.now() - 3599850, finished_at: Date.now() - 3597550 }
        }
      ]
    };
  }

  /**
   * Get analytics using MCP
   */
  async getAnalytics(params: {
    metrics: string[];
    startDate: string;
    endDate: string;
    groupBy?: string[];
    filters?: Record<string, string[]>;
  }): Promise<any> {
    console.log("📊 MCP Tool: get_analytics", JSON.stringify(params, null, 2));
    
    // In a real agent, this would be:
    // const result = await mcp.call("get_analytics", params);
    
    return {
      metrics: {
        "performance.completion_time": [
          { timestamp: Date.now() - 86400000, value: 2500, group: "code-generation" },
          { timestamp: Date.now() - 86400000, value: 1800, group: "data-analysis" }
        ],
        "cost.total_cost": [
          { timestamp: Date.now() - 86400000, value: 0.0045, group: "code-generation" },
          { timestamp: Date.now() - 86400000, value: 0.0032, group: "data-analysis" }
        ]
      }
    };
  }
}

const mcpTools = new MCPTools();

/**
 * Self-Monitoring Agent
 * Monitors its own performance using MCP tools
 */
class SelfMonitoringAgent {
  @trace({ name: "self-monitoring-agent" })
  async execute(task: string): Promise<string> {
    console.log(`\n🤖 Executing task: ${task}`);
    
    // Perform the task
    const result = await this.performTask(task);
    
    // Check recent performance
    await this.checkPerformance();
    
    return result;
  }

  @span({ type: "agent_skill", name: "task-execution" })
  async performTask(task: string): Promise<string> {
    console.log("⚙️  Performing task...");
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: task }]
    });
    
    return response.content[0].type === "text" ? response.content[0].text : "";
  }

  @span({ type: "agent_skill", name: "performance-check" })
  async checkPerformance(): Promise<void> {
    console.log("\n📊 Checking recent performance...");
    
    // Query recent traces using MCP
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const now = new Date().toISOString();
    
    const recentTraces = await mcpTools.searchTraces({
      filters: {
        "metadata.task_type": ["agent-execution"]
      },
      startDate: oneHourAgo,
      endDate: now,
      pageSize: 10
    });
    
    // Analyze error rate
    const totalTraces = recentTraces.traces.length;
    const errorCount = recentTraces.traces.filter((t: any) => t.error).length;
    const errorRate = totalTraces > 0 ? errorCount / totalTraces : 0;
    
    console.log(`   Total traces: ${totalTraces}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Error rate: ${(errorRate * 100).toFixed(1)}%`);
    
    if (errorRate > 0.1) {
      console.warn(`   ⚠️  High error rate detected!`);
    } else {
      console.log(`   ✅ Performance looks good`);
    }
    
    // Calculate average cost
    const avgCost = recentTraces.traces.reduce((sum: number, t: any) => 
      sum + (t.metrics?.total_cost || 0), 0) / totalTraces;
    console.log(`   Average cost: $${avgCost.toFixed(4)}`);
  }
}

/**
 * Adaptive Agent
 * Adapts strategy based on historical performance
 */
class AdaptiveAgent {
  @trace({ name: "adaptive-agent" })
  async execute(query: string): Promise<string> {
    console.log(`\n🧠 Adaptive agent executing: ${query}`);
    
    // Analyze historical performance
    const analytics = await this.analyzeHistoricalPerformance();
    
    // Select best strategy
    const strategy = this.selectStrategy(analytics);
    console.log(`   Selected strategy: ${strategy}`);
    
    // Execute with chosen strategy
    return await this.executeWithStrategy(query, strategy);
  }

  @span({ type: "agent_skill", name: "historical-analysis" })
  async analyzeHistoricalPerformance(): Promise<any> {
    console.log("📈 Analyzing historical performance...");
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const now = new Date().toISOString();
    
    const analytics = await mcpTools.getAnalytics({
      metrics: ["performance.completion_time", "cost.total_cost"],
      startDate: sevenDaysAgo,
      endDate: now,
      groupBy: ["metadata.strategy"]
    });
    
    return analytics;
  }

  selectStrategy(analytics: any): string {
    // Simple strategy selection based on cost
    const strategies = analytics.metrics["cost.total_cost"];
    
    if (!strategies || strategies.length === 0) {
      return "default";
    }
    
    // Find lowest cost strategy
    const lowestCost = strategies.reduce((min: any, curr: any) => 
      curr.value < min.value ? curr : min
    );
    
    return lowestCost.group || "default";
  }

  @span({ type: "agent_skill", name: "strategy-execution" })
  async executeWithStrategy(query: string, strategy: string): Promise<string> {
    console.log(`⚙️  Executing with strategy: ${strategy}`);
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Using ${strategy} approach: ${query}`
      }]
    });
    
    return response.content[0].type === "text" ? response.content[0].text : "";
  }
}

/**
 * Learning Agent
 * Learns from successful examples
 */
class LearningAgent {
  @trace({ name: "learning-agent" })
  async execute(task: string, taskType: string): Promise<string> {
    console.log(`\n🎓 Learning agent executing: ${task}`);
    
    // Retrieve successful examples
    const examples = await this.getSuccessfulExamples(taskType);
    
    console.log(`   Found ${examples.length} successful examples`);
    
    // Use examples to inform approach
    const result = await this.generateWithExamples(task, examples);
    
    return result;
  }

  @span({ type: "agent_skill", name: "retrieve-examples" })
  async getSuccessfulExamples(taskType: string): Promise<any[]> {
    console.log(`📚 Retrieving successful examples for: ${taskType}`);
    
    const traces = await mcpTools.searchTraces({
      filters: {
        "metadata.task_type": [taskType],
        "error.has_error": ["false"]
      },
      pageSize: 5
    });
    
    return traces.traces.map((t: any) => ({
      input: t.input?.value,
      output: t.output?.value,
      cost: t.metrics?.total_cost
    }));
  }

  @span({ type: "agent_skill", name: "generate-with-examples" })
  async generateWithExamples(task: string, examples: any[]): Promise<string> {
    console.log("🔨 Generating response using examples...");
    
    const examplesText = examples
      .map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`)
      .join("\n\n");
    
    const prompt = `Here are some successful examples:\n\n${examplesText}\n\nNow complete this task: ${task}`;
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    
    return response.content[0].type === "text" ? response.content[0].text : "";
  }
}

/**
 * Run the examples
 */
async function main() {
  console.log("🚀 Starting MCP Integration Examples");
  console.log("=" .repeat(50));
  
  // Example 1: Self-Monitoring Agent
  console.log("\n📊 Example 1: Self-Monitoring Agent");
  console.log("-".repeat(50));
  const monitoringAgent = new SelfMonitoringAgent();
  await monitoringAgent.execute("Analyze the performance of recent executions");
  
  // Example 2: Adaptive Agent
  console.log("\n\n🧠 Example 2: Adaptive Agent");
  console.log("-".repeat(50));
  const adaptiveAgent = new AdaptiveAgent();
  await adaptiveAgent.execute("Generate a Python function for data processing");
  
  // Example 3: Learning Agent
  console.log("\n\n🎓 Example 3: Learning Agent");
  console.log("-".repeat(50));
  const learningAgent = new LearningAgent();
  await learningAgent.execute(
    "Create a function to validate email addresses",
    "code-generation"
  );
  
  console.log("\n" + "=".repeat(50));
  console.log("✨ Examples complete!");
  console.log("\n📊 View your traces at: https://app.langwatch.ai");
  console.log("\nℹ️  Note: In a real Claude Code agent, MCP tools would be");
  console.log("   available through the agent's tool-calling capabilities.");
  console.log("   This example demonstrates the patterns and use cases.");
  
  // Give time for traces to export
  await new Promise(resolve => setTimeout(resolve, 2000));
}

main().catch(console.error);
