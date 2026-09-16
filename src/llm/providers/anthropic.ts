import Anthropic from '@anthropic-ai/sdk';
import { extractionJsonSchema } from '../../schema';
import { ExtractError } from '../errors';
import type { CompleteFn } from './types';

const MAX_TOKENS = 4096;

export const completeAnthropic: CompleteFn = async (options, messages) => {
  // A personal extension using the user's own locally-stored key, not a
  // shared web app - the SDK's warning is about the latter.
  const client = new Anthropic({
    apiKey: options.apiKey.trim(),
    dangerouslyAllowBrowser: true,
    fetch: options.fetchImpl,
  });

  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest: Anthropic.MessageParam[] = messages
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await client.messages.create({
      model: options.model,
      max_tokens: MAX_TOKENS,
      system: system || undefined,
      messages: rest,
      output_config: { format: { type: 'json_schema', schema: extractionJsonSchema } },
    });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!block?.text) throw new ExtractError('invalid_output', 'The model returned an empty response. Try again.');
    return block.text;
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ExtractError('bad_key', 'Anthropic rejected your API key. Check it in the options.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ExtractError('rate_limited', 'Anthropic rate-limited this request. Try again later.');
    }
    if (error instanceof Anthropic.NotFoundError) {
      throw new ExtractError('model_unavailable', 'That model id was not found. Check it in the options.');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ExtractError('network', 'Could not reach Anthropic. Check your connection.');
    }
    if (error instanceof Anthropic.APIError) {
      throw new ExtractError('api', `Anthropic error ${error.status ?? ''}: ${error.message}`.trim());
    }
    throw new ExtractError('api', error instanceof Error ? error.message : 'Unknown error calling Anthropic.');
  }
};
