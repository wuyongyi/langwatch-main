/**
 * Built-in response accuracy evaluator.
 * 
 * Assesses answer quality using heuristics to detect relevance, completeness,
 * and potential hallucinations or errors.
 */

import type { CustomEvaluator, EvaluationResult } from "../types";

/**
 * Response accuracy evaluator that assesses answer quality.
 * 
 * This evaluator uses heuristic analysis to determine if a response:
 * - Addresses the input question/request
 * - Provides sufficient detail
 * - Avoids hallucinations and contradictions
 * - Doesn't contain errors or refusals
 */
export const responseAccuracyEvaluator: CustomEvaluator = {
  name: "response-accuracy",
  
  async evaluate(
    input: string,
    output: string,
    context?: Record<string, any>
  ): Promise<EvaluationResult> {
    try {
      // If expected output is provided, use exact comparison
      if (context?.expected_output) {
        return compareWithExpected(output, context.expected_output);
      }
      
      // Check for error responses
      const errorCheck = detectErrors(output);
      if (errorCheck.hasError) {
        return {
          passed: false,
          score: 0.1,
          details: `Response contains error: ${errorCheck.reason}`,
        };
      }
      
      // Check for refusals
      const refusalCheck = detectRefusal(output);
      if (refusalCheck.isRefusal) {
        return {
          passed: false,
          score: 0.2,
          details: "Response is a refusal to answer",
        };
      }
      
      // Assess relevance to input
      const relevanceScore = assessRelevance(input, output);
      
      // Assess completeness
      const completenessScore = assessCompleteness(input, output);
      
      // Detect uncertainty and hallucinations
      const uncertaintyPenalty = detectUncertainty(output);
      
      // Calculate final score
      const finalScore = Math.max(
        0,
        (relevanceScore * 0.5 + completenessScore * 0.5) - uncertaintyPenalty
      );
      
      // Determine if passed
      const passed = finalScore >= 0.7;
      
      // Generate details
      let details = passed 
        ? "Response is relevant and complete"
        : "Response has quality issues";
      
      if (uncertaintyPenalty > 0) {
        details += " (contains uncertain language)";
      }
      
      if (completenessScore < 0.6) {
        details += " (partial or incomplete)";
      }
      
      return {
        passed,
        score: finalScore,
        details,
        metadata: {
          relevance: relevanceScore,
          completeness: completenessScore,
          uncertainty: uncertaintyPenalty,
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
 * Compare output with expected output.
 */
function compareWithExpected(output: string, expected: string): EvaluationResult {
  const outputNorm = output.trim().toLowerCase();
  const expectedNorm = expected.trim().toLowerCase();
  
  // Exact match
  if (outputNorm === expectedNorm) {
    return {
      passed: true,
      score: 1.0,
      details: "Output matches expected result",
    };
  }
  
  // Partial match
  if (outputNorm.includes(expectedNorm) || expectedNorm.includes(outputNorm)) {
    return {
      passed: true,
      score: 0.8,
      details: "Output partially matches expected result",
    };
  }
  
  // No match
  return {
    passed: false,
    score: 0.3,
    details: `Output does not match expected result. Expected: "${expected}"`,
  };
}

/**
 * Detect error messages in output.
 */
function detectErrors(output: string): { hasError: boolean; reason?: string } {
  const errorPatterns = [
    /error:/i,
    /exception:/i,
    /failed to/i,
    /unable to/i,
    /could not/i,
  ];
  
  for (const pattern of errorPatterns) {
    if (pattern.test(output)) {
      return { hasError: true, reason: "error message detected" };
    }
  }
  
  return { hasError: false };
}

/**
 * Detect refusal to answer.
 */
function detectRefusal(output: string): { isRefusal: boolean } {
  const refusalPatterns = [
    /i cannot/i,
    /i can't/i,
    /i'm unable to/i,
    /i don't know/i,
    /i do not know/i,
    /sorry, i cannot/i,
  ];
  
  const outputLower = output.toLowerCase();
  
  for (const pattern of refusalPatterns) {
    if (pattern.test(outputLower)) {
      return { isRefusal: true };
    }
  }
  
  return { isRefusal: false };
}

/**
 * Assess relevance of output to input.
 */
function assessRelevance(input: string, output: string): number {
  // Extract key terms from input
  const inputTerms = extractKeyTerms(input);
  const outputLower = output.toLowerCase();
  
  // Check how many input terms appear in output
  let matchCount = 0;
  for (const term of inputTerms) {
    if (outputLower.includes(term.toLowerCase())) {
      matchCount++;
    }
  }
  
  // Calculate relevance score
  const relevanceRatio = inputTerms.length > 0 ? matchCount / inputTerms.length : 0;
  
  // Penalize very short responses
  if (output.length < 20) {
    return relevanceRatio * 0.5;
  }
  
  // Penalize generic responses
  const genericPhrases = ["that's a good question", "interesting question", "let me think"];
  const hasGeneric = genericPhrases.some(phrase => outputLower.includes(phrase));
  if (hasGeneric && output.length < 100) {
    return relevanceRatio * 0.6;
  }
  
  return relevanceRatio;
}

/**
 * Assess completeness of response.
 */
function assessCompleteness(input: string, output: string): number {
  let score = 0.5; // Base score
  
  // Reward longer, detailed responses
  if (output.length > 100) score += 0.2;
  if (output.length > 300) score += 0.1;
  
  // Reward structured responses (lists, paragraphs)
  const hasStructure = output.includes("\n") || output.includes("- ") || output.includes("1.") || output.includes(":");
  if (hasStructure) {
    score += 0.2;
  }
  
  // Check if input asks for multiple things
  const requestsMultiple = /\band\b|multiple|several|list|explain.*and/i.test(input);
  if (requestsMultiple) {
    // Penalize if output is too short for multi-part question
    if (output.length < 150) {
      score -= 0.3;
    }
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Detect uncertainty and potential hallucinations.
 */
function detectUncertainty(output: string): number {
  let penalty = 0;
  
  const uncertainPhrases = [
    "i think",
    "i believe",
    "might be",
    "could be",
    "probably",
    "i'm not sure",
    "not certain",
  ];
  
  const outputLower = output.toLowerCase();
  
  for (const phrase of uncertainPhrases) {
    if (outputLower.includes(phrase)) {
      penalty += 0.1;
    }
  }
  
  // Detect contradictions
  if (outputLower.includes("actually") && outputLower.includes("well")) {
    penalty += 0.15;
  }
  
  return Math.min(0.5, penalty);
}

/**
 * Extract key terms from input.
 */
function extractKeyTerms(input: string): string[] {
  // Remove common question words
  const stopWords = ["what", "how", "why", "when", "where", "who", "is", "are", "the", "a", "an", "do", "does"];
  
  // Split into words and filter
  const words = input.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word));
  
  return words;
}
