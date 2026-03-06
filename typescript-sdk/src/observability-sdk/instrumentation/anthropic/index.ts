/**
 * Auto-instrumentation for Anthropic Claude API client.
 * 
 * This module provides automatic tracing for Claude API calls, capturing
 * model information, token usage, costs, and response content.
 */

import { getLangWatchTracer } from "../../tracer";
import * as semconv from "@opentelemetry/semantic-conventions/incubating";
import { calculateCost } from "./pricing";

/**
 * Anthropic client interface (minimal subset needed for instrumentation)
 */
export interface AnthropicClient {
  messages: {
    create: (params: MessageCreateParams) => Promise<MessageResponse>;
  };
  [key: string]: any;
}

/**
 * Message create parameters
 */
export interface MessageCreateParams {
  model: string;
  messages: Array<{ role: string; content: string | any }>;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  [key: string]: any;
}

/**
 * Message response from Claude API
 */
export interface MessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string; [key: string]: any }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: any;
}

/**
 * Instrument an Anthropic Claude API client to automatically create LLM spans.
 * 
 * This function wraps the client's methods to create OpenTelemetry spans for each
 * API call, capturing model information, token usage, costs, and response content.
 * 
 * @param client - The Anthropic client instance to instrument
 * @returns The instrumented client with the same interface
 * 
 * @example
 * ```typescript
 * import Anthropic from "@anthropic-ai/sdk";
 * import { instrumentClaudeClient } from "langwatch/observability/instrumentation/anthropic";
 * 
 * const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 * const instrumentedClient = instrumentClaudeClient(client);
 * 
 * // All API calls now automatically create LLM spans
 * const response = await instrumentedClient.messages.create({
 *   model: "claude-3-5-sonnet-20241022",
 *   messages: [{ role: "user", content: "Hello" }],
 *   max_tokens: 100
 * });
 * ```
 */
export function instrumentClaudeClient<T extends AnthropicClient>(
  client: T
): T {
  // Create a proxy to intercept method calls
  const instrumentedMessages = {
    ...client.messages,
    create: createInstrumentedMessageCreate(client.messages.create.bind(client.messages)),
  };

  return {
    ...client,
    messages: instrumentedMessages,
  };
}

/**
 * Create an instrumented version of the messages.create method
 */
function createInstrumentedMessageCreate(
  originalCreate: (params: MessageCreateParams) => Promise<MessageResponse>
) {
  return async function instrumentedCreate(
    params: MessageCreateParams
  ): Promise<MessageResponse> {
    const tracer = getLangWatchTracer("anthropic");

    return tracer.withActiveSpan("claude.messages.create", async (span) => {
      // Set span type to LLM
      span.setType("llm");

      // Set gen_ai.system to "anthropic"
      span.setAttribute("gen_ai.system", "anthropic");

      // Capture request model
      span.setRequestModel(params.model);

      // Capture request parameters
      span.setAttribute(semconv.ATTR_GEN_AI_REQUEST_MAX_TOKENS, params.max_tokens);
      
      if (params.temperature !== undefined) {
        span.setAttribute(semconv.ATTR_GEN_AI_REQUEST_TEMPERATURE, params.temperature);
      }
      
      if (params.top_p !== undefined) {
        span.setAttribute(semconv.ATTR_GEN_AI_REQUEST_TOP_P, params.top_p);
      }

      // Capture request messages as input
      span.setInput("chat_messages", params.messages);

      // Execute the original API call
      const response = await originalCreate(params);

      // Capture response model (may differ from request)
      span.setResponseModel(response.model);

      // Capture token usage
      const promptTokens = response.usage.input_tokens;
      const completionTokens = response.usage.output_tokens;
      const totalTokens = promptTokens + completionTokens;

      span.setAttribute(semconv.ATTR_GEN_AI_USAGE_PROMPT_TOKENS, promptTokens);
      span.setAttribute(semconv.ATTR_GEN_AI_USAGE_COMPLETION_TOKENS, completionTokens);
      span.setAttribute("gen_ai.usage.total_tokens", totalTokens);

      // Calculate and capture cost
      const cost = calculateCost({
        model: response.model,
        promptTokens,
        completionTokens,
      });
      span.setAttribute("langwatch.cost", cost);

      // Capture response content as output
      const outputText = response.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      
      span.setOutput("text", outputText);

      return response;
    });
  };
}
