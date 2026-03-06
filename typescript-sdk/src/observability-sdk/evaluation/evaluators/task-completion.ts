/**
 * Built-in task completion evaluator.
 * 
 * Verifies that the agent completed the requested task, checking for partial
 * or incomplete responses and validating output format matches requirements.
 */

import type { CustomEvaluator, EvaluationResult } from "../types";

/**
 * Task completion evaluator that verifies tasks are fully completed.
 * 
 * This evaluator checks:
 * - Whether the output addresses the input task
 * - If the output format matches requirements (JSON, list, etc.)
 * - Whether all components of multi-part tasks are present
 * - If success criteria (when provided) are met
 */
export const taskCompletionEvaluator: CustomEvaluator = {
  name: "task-completion",
  
  async evaluate(
    input: string,
    output: string,
    context?: Record<string, any>
  ): Promise<EvaluationResult> {
    try {
      // If success criteria provided, check against them
      if (context?.success_criteria && Array.isArray(context.success_criteria)) {
        return checkSuccessCriteria(output, context.success_criteria);
      }
      
      // Check if output addresses the task
      const addressesTask = checkTaskAddressed(input, output);
      if (!addressesTask.addressed) {
        return {
          passed: false,
          score: 0.2,
          details: `Task not completed: ${addressesTask.reason}`,
        };
      }
      
      // Check format requirements
      const formatCheck = checkFormatRequirements(input, output);
      if (!formatCheck.valid) {
        return {
          passed: false,
          score: 0.4,
          details: `Output format issue: ${formatCheck.reason}`,
        };
      }
      
      // Check for completeness
      const completenessScore = assessTaskCompleteness(input, output);
      
      // Determine if passed
      const passed = completenessScore >= 0.8;
      
      return {
        passed,
        score: completenessScore,
        details: passed 
          ? "Task completed successfully"
          : completenessScore < 0.5 
            ? "Task not completed or missing major components"
            : "Task incomplete or missing some components",
        metadata: {
          format_valid: formatCheck.valid,
          addresses_task: addressesTask.addressed,
        },
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        details: `Evaluation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Check if output meets provided success criteria.
 */
function checkSuccessCriteria(output: string, criteria: string[]): EvaluationResult {
  const outputLower = output.toLowerCase();
  let metCount = 0;
  const unmetCriteria: string[] = [];
  
  for (const criterion of criteria) {
    const criterionLower = criterion.toLowerCase();
    
    // Check for specific patterns
    let met = false;
    
    if (criterionLower.includes("function") && criterionLower.includes("defined")) {
      met = /def |function /.test(output);
    } else if (criterionLower.includes("parameter")) {
      met = /\([^)]*\w+[^)]*\)/.test(output);
    } else if (criterionLower.includes("return")) {
      met = /return /.test(output);
    } else if (criterionLower.includes("docstring")) {
      met = /"""/.test(output) || /'''/.test(output);
    } else if (criterionLower.includes("type hint")) {
      met = /:\s*\w+/.test(output) && /->/.test(output);
    } else {
      // Extract key terms from criterion
      const terms = criterionLower.split(/\s+/).filter(t => t.length > 3);
      met = terms.every(term => outputLower.includes(term));
    }
    
    if (met) {
      metCount++;
    } else {
      unmetCriteria.push(criterion);
    }
  }
  
  const score = criteria.length > 0 ? metCount / criteria.length : 0;
  const passed = score >= 0.8;
  
  return {
    passed,
    score,
    details: passed
      ? `All success criteria met (${metCount}/${criteria.length})`
      : `Success criteria not met: ${unmetCriteria.join(", ")}`,
    metadata: {
      met_criteria: metCount,
      total_criteria: criteria.length,
      unmet: unmetCriteria,
    },
  };
}

/**
 * Check if output addresses the input task.
 */
function checkTaskAddressed(input: string, output: string): { addressed: boolean; reason?: string } {
  // Check for generic non-answers
  const genericPhrases = [
    "i can help",
    "let me help",
    "i'll help",
    "that's a good question",
    "interesting question",
  ];
  
  const outputLower = output.toLowerCase();
  const isGeneric = genericPhrases.some(phrase => outputLower.includes(phrase));
  
  if (isGeneric && output.length < 100) {
    return { addressed: false, reason: "generic response without actual completion" };
  }
  
  // Check if output is too short for the task (but allow short answers for simple tasks)
  const isSimpleTask = /calculate|what is|list.*under/i.test(input);
  if (!isSimpleTask && output.length < 20) {
    return { addressed: false, reason: "response too short" };
  }
  
  // Extract action verbs from input
  const actionVerbs = ["write", "create", "implement", "generate", "build"];
  const hasAction = actionVerbs.some(verb => input.toLowerCase().includes(verb));
  
  if (hasAction) {
    // For action-based tasks, check if output contains substantive content
    const hasCode = /```|def |function |class |const |let |var /.test(output);
    const hasData = /\d+|[[\]{}]/.test(output);
    const hasExplanation = output.length > 50;
    
    if (!hasCode && !hasData && !hasExplanation) {
      return { addressed: false, reason: "no substantive content provided" };
    }
  }
  
  return { addressed: true };
}

/**
 * Check if output format matches requirements from input.
 */
function checkFormatRequirements(input: string, output: string): { valid: boolean; reason?: string } {
  const inputLower = input.toLowerCase();
  
  // Check for JSON requirement
  if (inputLower.includes("json") || inputLower.includes("as json")) {
    // First check if input is asking to "return as JSON" vs just mentioning JSON
    const isFormatRequirement = /return.*json|as json|in json|format.*json/i.test(input);
    
    if (isFormatRequirement) {
      try {
        JSON.parse(output);
        return { valid: true };
      } catch {
        // Check if JSON is embedded in text
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            JSON.parse(jsonMatch[0]);
            return { valid: true };
          } catch {
            return { valid: false, reason: "JSON format required but not provided" };
          }
        }
        return { valid: false, reason: "JSON format required but not provided" };
      }
    }
  }
  
  // Check for list requirement
  if (inputLower.includes("list") && !inputLower.includes("linked list")) {
    const hasList = output.includes("-") || output.includes("1.") || output.includes("[") || output.includes("\n");
    if (!hasList) {
      return { valid: false, reason: "list format required but not provided" };
    }
  }
  
  return { valid: true };
}

/**
 * Assess overall task completeness.
 */
function assessTaskCompleteness(input: string, output: string): number {
  let score = 0.5; // Base score
  
  // Check for multi-part tasks
  const hasMultipleParts = /\band\b|,.*,/.test(input);
  
  if (hasMultipleParts) {
    // Count how many parts are addressed
    const inputParts = input.split(/\band\b|,/).filter(p => p.trim().length > 5);
    let addressedParts = 0;
    
    for (const part of inputParts) {
      const partTerms = part.toLowerCase().split(/\s+/).filter(t => t.length > 3);
      const hasTerms = partTerms.some(term => output.toLowerCase().includes(term));
      if (hasTerms) {
        addressedParts++;
      }
    }
    
    const completionRatio = inputParts.length > 0 ? addressedParts / inputParts.length : 0;
    score = completionRatio;
  } else {
    // Single-part task - assess based on output quality
    
    // For simple tasks (calculate, list), short answers are fine
    const isSimpleTask = /calculate|what is|list.*under/i.test(input);
    const isJSONTask = /return.*json|as json/i.test(input);
    
    if ((isSimpleTask || isJSONTask) && output.length > 10) {
      // Check if output contains actual result
      const hasResult = /\d+|=|:|{|}|\[|\]/.test(output);
      if (hasResult) {
        score = 0.9; // High score for direct answers to simple tasks
      }
    } else {
      // Reward substantive output
      if (output.length > 100) score += 0.2;
      if (output.length > 300) score += 0.1;
      
      // Reward structured output
      if (output.includes("```") || output.includes("\n\n")) score += 0.1;
      
      // Check for action completion indicators
      const completionIndicators = ["here's", "here is", "result", "answer", "solution", "="];
      const hasIndicator = completionIndicators.some(ind => output.toLowerCase().includes(ind));
      if (hasIndicator) score += 0.2;
    }
  }
  
  return Math.max(0, Math.min(1, score));
}
