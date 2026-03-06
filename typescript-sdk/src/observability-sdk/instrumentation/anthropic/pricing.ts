/**
 * Claude model pricing information.
 * 
 * Prices are in USD per million tokens (MTok).
 * Source: https://www.anthropic.com/pricing
 */

/**
 * Pricing for a specific Claude model.
 */
export interface ModelPricing {
  /** Price per million input tokens (USD) */
  inputPricePerMTok: number;
  /** Price per million output tokens (USD) */
  outputPricePerMTok: number;
}

/**
 * Model pricing lookup table.
 * Maps model names to their pricing information.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Sonnet
  "claude-3-5-sonnet-20241022": {
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
  },
  "claude-3-5-sonnet-20240620": {
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
  },

  // Claude 3 Opus
  "claude-3-opus-20240229": {
    inputPricePerMTok: 15.0,
    outputPricePerMTok: 75.0,
  },

  // Claude 3 Sonnet
  "claude-3-sonnet-20240229": {
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
  },

  // Claude 3 Haiku
  "claude-3-haiku-20240307": {
    inputPricePerMTok: 0.25,
    outputPricePerMTok: 1.25,
  },

  // Claude 3.5 Haiku
  "claude-3-5-haiku-20241022": {
    inputPricePerMTok: 1.0,
    outputPricePerMTok: 5.0,
  },
};

/**
 * Calculate the cost of a Claude API call based on token usage.
 * 
 * Formula: cost = (prompt_tokens × input_price + completion_tokens × output_price) / 1_000_000
 * 
 * @param model - The Claude model name
 * @param promptTokens - Number of input/prompt tokens
 * @param completionTokens - Number of output/completion tokens
 * @returns The cost in USD, or 0 if model pricing is unknown
 * 
 * @example
 * ```typescript
 * const cost = calculateCost("claude-3-5-sonnet-20241022", 1000, 500);
 * // Returns: 0.0105 (1000 * 3 / 1M + 500 * 15 / 1M)
 * ```
 */
export function calculateCost({
  model,
  promptTokens,
  completionTokens,
}: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    // Unknown model - return 0 cost
    return 0;
  }

  const inputCost = (promptTokens * pricing.inputPricePerMTok) / 1_000_000;
  const outputCost = (completionTokens * pricing.outputPricePerMTok) / 1_000_000;

  return inputCost + outputCost;
}
