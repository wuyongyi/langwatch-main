/**
 * Built-in code correctness evaluator.
 * 
 * Checks if generated code is syntactically valid, follows language conventions,
 * and detects common security issues.
 */

import type { CustomEvaluator, EvaluationResult } from "../types";

/**
 * Code correctness evaluator that validates syntax and security.
 */
export const codeCorrectnessEvaluator: CustomEvaluator = {
  name: "code-correctness",
  
  async evaluate(
    input: string,
    output: string,
    context?: Record<string, any>
  ): Promise<EvaluationResult> {
    try {
      // Extract code from output (handle markdown code blocks)
      const code = extractCode(output);
      
      // Detect language
      const language = detectLanguage(code, output, context);
      
      // Check for security issues first (critical)
      const securityIssues = detectSecurityIssues(code, language);
      if (securityIssues.length > 0) {
        return {
          passed: false,
          score: 0.3,
          details: `Security issues detected: ${securityIssues.join(", ")}`,
          metadata: { language, issues: securityIssues },
        };
      }
      
      // Check syntax validity
      const syntaxCheck = checkSyntax(code, language);
      if (!syntaxCheck.valid) {
        return {
          passed: false,
          score: 0.2,
          details: `Syntax error: ${syntaxCheck.error}`,
          metadata: { language, error: syntaxCheck.error },
        };
      }
      
      // Check code quality indicators
      const qualityScore = assessCodeQuality(code, language);
      
      return {
        passed: qualityScore >= 0.7,
        score: qualityScore,
        details: qualityScore >= 0.7 
          ? "Code is syntactically valid and follows conventions"
          : "Code has quality issues",
        metadata: { language },
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
 * Extract code from output, handling markdown code blocks.
 */
function extractCode(output: string): string {
  // Check for markdown code blocks
  const codeBlockMatch = output.match(/```[\w]*\n([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }
  
  // Check for inline code
  const inlineCodeMatch = output.match(/`([^`]+)`/);
  if (inlineCodeMatch && inlineCodeMatch[1] && inlineCodeMatch[1].includes("(") && inlineCodeMatch[1].includes(")")) {
    return inlineCodeMatch[1];
  }
  
  // Return as-is if no code blocks found
  return output.trim();
}

/**
 * Detect programming language from code and context.
 */
function detectLanguage(
  code: string,
  output: string,
  context?: Record<string, any>
): string {
  // Check context first
  if (context?.language) {
    return context.language.toLowerCase();
  }
  
  // Check markdown language hint
  const langMatch = output.match(/```(\w+)/);
  if (langMatch && langMatch[1]) {
    return langMatch[1].toLowerCase();
  }
  
  // Heuristic detection
  if (code.includes("def ") || code.includes("import ") || code.includes("print(")) {
    return "python";
  }
  if (code.includes("function ") || code.includes("const ") || code.includes("let ") || code.includes("=>")) {
    return "javascript";
  }
  if (code.includes("public class") || code.includes("private ") || code.includes("System.out")) {
    return "java";
  }
  
  return "unknown";
}

/**
 * Detect common security issues in code.
 */
function detectSecurityIssues(code: string, language: string): string[] {
  const issues: string[] = [];
  
  // SQL injection patterns - look for string concatenation in SQL queries
  if (code.match(/["']SELECT\s+.*["']\s*\+|["']INSERT\s+.*["']\s*\+|["']UPDATE\s+.*["']\s*\+|["']DELETE\s+.*["']\s*\+/i)) {
    issues.push("SQL injection");
  }
  
  // XSS patterns
  if (code.match(/innerHTML\s*=.*\+|document\.write\(.*\+/)) {
    issues.push("XSS");
  }
  
  // Dangerous eval usage
  if (code.match(/\beval\s*\(/)) {
    issues.push("eval usage");
  }
  
  // Command injection (Python)
  if (language === "python" && code.match(/os\.system\(.*\+|subprocess\.call\(.*\+/)) {
    issues.push("command injection");
  }
  
  return issues;
}

/**
 * Check syntax validity (basic heuristics).
 */
function checkSyntax(code: string, language: string): { valid: boolean; error?: string } {
  // Check for balanced braces/brackets/parentheses
  const braceBalance = checkBalanced(code, "{", "}");
  if (!braceBalance.balanced) {
    return { valid: false, error: "Unbalanced braces" };
  }
  
  const bracketBalance = checkBalanced(code, "[", "]");
  if (!bracketBalance.balanced) {
    return { valid: false, error: "Unbalanced brackets" };
  }
  
  const parenBalance = checkBalanced(code, "(", ")");
  if (!parenBalance.balanced) {
    return { valid: false, error: "Unbalanced parentheses" };
  }
  
  // Language-specific checks
  if (language === "python") {
    // Check for incomplete function definitions
    if (code.match(/def\s+\w+\s*\([^)]*$/m)) {
      return { valid: false, error: "Incomplete function definition" };
    }
  }
  
  if (language === "javascript" || language === "java") {
    // Check for incomplete statements
    if (code.match(/=\s*;|const\s+\w+\s*=\s*;/)) {
      return { valid: false, error: "Incomplete assignment" };
    }
  }
  
  return { valid: true };
}

/**
 * Check if delimiters are balanced.
 */
function checkBalanced(code: string, open: string, close: string): { balanced: boolean; count: number } {
  let count = 0;
  let inString = false;
  let stringChar = "";
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : "";
    
    // Handle string literals
    if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }
    
    // Count delimiters outside strings
    if (!inString) {
      if (char === open) count++;
      if (char === close) count--;
    }
  }
  
  return { balanced: count === 0, count };
}

/**
 * Assess code quality based on conventions and structure.
 */
function assessCodeQuality(code: string, language: string): number {
  let score = 1.0;
  
  // Penalize very short code (likely incomplete)
  if (code.length < 20) {
    score -= 0.2;
  }
  
  // Reward proper indentation
  const lines = code.split("\n");
  const hasIndentation = lines.some(line => line.match(/^\s{2,}/));
  if (hasIndentation) {
    score += 0.1;
  }
  
  // Reward comments/docstrings
  if (code.includes("//") || code.includes("#") || code.includes('"""') || code.includes("/*")) {
    score += 0.1;
  }
  
  // Penalize very long lines (poor readability)
  const hasLongLines = lines.some(line => line.length > 120);
  if (hasLongLines) {
    score -= 0.1;
  }
  
  // Ensure score is in valid range
  return Math.max(0, Math.min(1, score));
}
