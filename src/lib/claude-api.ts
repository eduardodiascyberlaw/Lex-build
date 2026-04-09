import Anthropic from "@anthropic-ai/sdk";
import { decrypt } from "@/lib/encryption";
import { createLogger } from "@/lib/logger";

const logger = createLogger("claude-api");

/**
 * Create an Anthropic client using the user's encrypted API key.
 */
export function createClaudeClient(apiKeyEnc: string): Anthropic {
  const apiKey = decrypt(apiKeyEnc);
  return new Anthropic({ apiKey });
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Call Claude API (non-streaming) with system prompt and messages.
 */
export async function callClaude(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 8192
): Promise<ClaudeCallResult> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const content = textBlock?.text ?? "";

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Stream Claude API response. Yields text chunks.
 */
export async function* streamClaude(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 8192
): AsyncGenerator<string, ClaudeCallResult> {
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let fullContent = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullContent += event.delta.text;
      yield event.delta.text;
    }
    if (event.type === "message_delta" && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === "message_start" && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  return {
    content: fullContent,
    inputTokens,
    outputTokens,
  };
}
