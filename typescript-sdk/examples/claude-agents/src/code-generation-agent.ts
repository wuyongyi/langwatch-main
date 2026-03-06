/**
 * Code Generation Agent Example with Evaluation
 * 
 * This example demonstrates:
 * - Building an agent that generates code based on prompts
 * - Using code correctness evaluator to validate output
 * - Running scenario-based tests
 * - Tracking code quality metrics
 */

import Anthropic from "@anthropic-ai/sdk";
import { setupObservability } from "langwatch/observability/node";
import { trace, span } from "langwatch/observability";
import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";
import { LangWatch } from "langwatch";
import "dotenv/config";

// Initialize LangWatch observability
await setupObservability({
  serviceName: "code-generation-agent",
  captureInput: true,
  captureOutput: true
});

// Setup instrumented Claude client
const client = instrumentClaudeClient(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Initialize LangWatch client for evaluations
const langwatch = new LangWatch({
  apiKey: process.env.LANGWATCH_API_KEY,
  endpoint: process.env.LANGWATCH_ENDPOINT
});

/**
 * Code Generation Agent
 */
class CodeGenerationAgent {
  /**
   * Generate code based on a natural language prompt
   */
  @trace({ name: "code-generation" })
  async generateCode(prompt: string, language: string = "python"): Promise<string> {
    console.log(`\n💻 Generating ${language} code for: ${prompt}`);
    
    // Parse requirements from prompt
    const requirements = await this.parseRequirements(prompt, language);
    
    // Generate code
    const code = await this.synthesizeCode(requirements, language);
    
    // Validate syntax
    const isValid = await this.validateSyntax(code, language);
    
    if (!isValid) {
      console.log("⚠️  Generated code has syntax errors, attempting fix...");
      return await this.fixSyntaxErrors(code, language);
    }
    
    console.log(`\n✅ Generated code:\n${code}`);
    
    return code;
  }

  @span({ type: "agent_skill", name: "requirement-parsing" })
  async parseRequirements(prompt: string, language: string): Promise<string> {
    console.log("📋 Parsing requirements...");
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Extract the key requirements from this coding request:\n\n${prompt}\n\nList the requirements clearly.`
      }]
    });
    
    return response.content[0].type === "text" ? response.content[0].text : "";
  }

  @span({ type: "agent_skill", name: "code-synthesis" })
  async synthesizeCode(requirements: string, language: string): Promise<string> {
    console.log("🔨 Synthesizing code...");
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Write ${language} code that meets these requirements:\n\n${requirements}\n\nProvide only the code, no explanations.`
      }]
    });
    
    let code = response.content[0].type === "text" ? response.content[0].text : "";
    
    // Extract code from markdown blocks if present
    const codeBlockMatch = code.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }
    
    return code.trim();
  }

  @span({ type: "agent_skill", name: "syntax-validation" })
  async validateSyntax(code: string, language: string): Promise<boolean> {
    console.log("🔍 Validating syntax...");
    
    // Simple validation - check for common syntax patterns
    // In a real agent, you'd use language-specific parsers
    if (language === "python") {
      // Check for basic Python syntax
      return !code.includes("SyntaxError") && code.length > 0;
    }
    
    return true;
  }

  @span({ type: "agent_skill", name: "syntax-fix" })
  async fixSyntaxErrors(code: string, language: string): Promise<string> {
    console.log("🔧 Fixing syntax errors...");
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Fix the syntax errors in this ${language} code:\n\n${code}\n\nProvide only the corrected code.`
      }]
    });
    
    return response.content[0].type === "text" ? response.content[0].text : code;
  }
}

/**
 * Simple code correctness evaluator
 */
function evaluateCodeCorrectness(code: string, language: string): { passed: boolean; score: number; details: string } {
  let score = 1.0;
  const issues: string[] = [];
  
  // Check if code is not empty
  if (!code || code.trim().length === 0) {
    return { passed: false, score: 0, details: "Generated code is empty" };
  }
  
  // Language-specific checks
  if (language === "python") {
    // Check for function definition
    if (!code.includes("def ")) {
      issues.push("No function definition found");
      score -= 0.3;
    }
    
    // Check for docstring
    if (!code.includes('"""') && !code.includes("'''")) {
      issues.push("No docstring found");
      score -= 0.2;
    }
    
    // Check for return statement
    if (!code.includes("return")) {
      issues.push("No return statement found");
      score -= 0.2;
    }
  }
  
  const passed = score >= 0.7;
  const details = issues.length > 0 
    ? `Issues found: ${issues.join(", ")}` 
    : "Code meets basic correctness criteria";
  
  return { passed, score: Math.max(0, score), details };
}

/**
 * Run scenario-based tests
 */
async function runScenarioTests(agent: CodeGenerationAgent) {
  console.log("\n" + "=".repeat(50));
  console.log("🧪 Running Scenario Tests");
  console.log("=".repeat(50));
  
  const scenarios = [
    {
      name: "Generate sorting function",
      prompt: "Create a Python function that sorts a list of integers in ascending order",
      language: "python",
      criteria: [
        "Function accepts a list parameter",
        "Function returns a sorted list",
        "Code includes docstring"
      ]
    },
    {
      name: "Generate string reversal function",
      prompt: "Create a Python function that reverses a string",
      language: "python",
      criteria: [
        "Function accepts a string parameter",
        "Function returns reversed string",
        "Code includes docstring"
      ]
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n📝 Scenario: ${scenario.name}`);
    
    try {
      // Generate code
      const code = await agent.generateCode(scenario.prompt, scenario.language);
      
      // Evaluate code correctness
      const evaluation = evaluateCodeCorrectness(code, scenario.language);
      
      console.log(`   Evaluation: ${evaluation.passed ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`   Score: ${evaluation.score.toFixed(2)}`);
      console.log(`   Details: ${evaluation.details}`);
      
      results.push({
        scenario: scenario.name,
        passed: evaluation.passed,
        score: evaluation.score
      });
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      results.push({
        scenario: scenario.name,
        passed: false,
        score: 0
      });
    }
  }
  
  // Summary
  const passCount = results.filter(r => r.passed).length;
  const passRate = (passCount / results.length) * 100;
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 Scenario Test Results");
  console.log("=".repeat(50));
  console.log(`Total scenarios: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${results.length - passCount}`);
  console.log(`Pass rate: ${passRate.toFixed(1)}%`);
  
  return results;
}

/**
 * Run the example
 */
async function main() {
  console.log("🚀 Starting Code Generation Agent Example");
  console.log("=" .repeat(50));
  
  const agent = new CodeGenerationAgent();
  
  // Example 1: Generate a simple function
  await agent.generateCode(
    "Create a Python function that calculates the factorial of a number",
    "python"
  );
  
  // Example 2: Run scenario-based tests
  await runScenarioTests(agent);
  
  console.log("\n" + "=".repeat(50));
  console.log("✨ Examples complete!");
  console.log("\n📊 View your traces at: https://app.langwatch.ai");
  console.log("   - See code generation traces with evaluations");
  console.log("   - Analyze code quality metrics");
  console.log("   - Review scenario test results");
  
  // Give time for traces to export
  await new Promise(resolve => setTimeout(resolve, 2000));
}

main().catch(console.error);
