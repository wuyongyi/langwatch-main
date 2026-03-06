/**
 * Basic Claude Code Agent Example with SDK Instrumentation
 * 
 * This example demonstrates:
 * - Using @trace decorator for agent entry points
 * - Using @span decorator for skill instrumentation
 * - Automatic Claude API call instrumentation
 * - Capturing inputs, outputs, and metadata
 */

import Anthropic from "@anthropic-ai/sdk";
import { setupObservability } from "langwatch/observability/node";
import { trace, span } from "langwatch/observability";
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";
import "dotenv/config";

// Initialize LangWatch observability
await setupObservability({
  serviceName: "basic-qa-agent",
  captureInput: true,
  captureOutput: true,
  customMetadata: {
    environment: "development",
    version: "1.0.0"
  }
});

// Setup instrumented Claude client
const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

/**
 * Simple Q&A Agent that retrieves context and generates answers
 */
class QAAgent {
  /**
   * Main entry point - automatically creates a trace
   * The @trace decorator captures the entire agent execution
   */
  @trace({ name: "qa-agent-execution" })
  async answerQuestion(question: string, userId?: string): Promise<string> {
    console.log(`\n🤔 Question: ${question}`);
    
    // Retrieve relevant context (simulated)
    const context = await this.retrieveContext(question);
    
    // Generate answer using Claude
    const answer = await this.generateAnswer(question, context);
    
    console.log(`\n✅ Answer: ${answer}`);
    
    return answer;
  }

  /**
   * Context retrieval skill
   * The @span decorator creates a nested span under the current trace
   */
  @span({ type: "agent_skill", name: "context-retrieval" })
  async retrieveContext(question: string): Promise<string[]> {
    console.log("📚 Retrieving context...");
    
    // Simulate context retrieval from a knowledge base
    // In a real agent, this might query a vector database
    const contexts = [
      "Paris is the capital and most populous city of France.",
      "The city has a population of over 2 million people.",
      "Paris is known for landmarks like the Eiffel Tower and Louvre Museum."
    ];
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return contexts;
  }

  /**
   * Answer generation skill
   * This demonstrates automatic Claude API instrumentation
   */
  @span({ type: "agent_skill", name: "answer-generation" })
  async generateAnswer(question: string, context: string[]): Promise<string> {
    console.log("🤖 Generating answer with Claude...");
    
    const prompt = `Context:\n${context.join("\n")}\n\nQuestion: ${question}\n\nProvide a concise answer based on the context.`;
    
    // This Claude API call is automatically instrumented
    // LangWatch captures: model, tokens, cost, latency, input/output
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    
    return response.content[0].type === "text" 
      ? response.content[0].text 
      : "";
  }
}

/**
 * Run the example
 */
async function main() {
  console.log("🚀 Starting Basic Q&A Agent Example");
  console.log("=" .repeat(50));
  
  const agent = new QAAgent();
  
  // Example 1: Simple question
  await agent.answerQuestion(
    "What is the capital of France?",
    "user-123"
  );
  
  // Example 2: Another question to show multiple traces
  await agent.answerQuestion(
    "How many people live in Paris?",
    "user-123"
  );
  
  console.log("\n" + "=".repeat(50));
  console.log("✨ Examples complete!");
  console.log("\n📊 View your traces at: https://app.langwatch.ai");
  console.log("   - Navigate to the Traces page");
  console.log("   - See execution tree with timing");
  console.log("   - Inspect LLM calls, tokens, and costs");
  
  // Give time for traces to export
  await new Promise(resolve => setTimeout(resolve, 2000));
}

main().catch(console.error);
