import { extractionJsonSchema } from '../../schema';
import { ExtractError } from '../errors';
import type { CompleteFn } from './types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export const completeOpenRouter: CompleteFn = async (options, messages) => {
  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey.trim()}`,
        'Content-Type': 'application/json',
        'X-Title': 'Tab to Cal',
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'calendar_events', strict: true, schema: extractionJsonSchema },
        },
        provider: { require_parameters: true },
      }),
    });
  } catch {
    throw new ExtractError('network', 'Could not reach OpenRouter. Check your connection.');
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: { message?: { content?: string | null } }[];
  } | null;

  if (!response.ok || body?.error) {
    throw toExtractError(response.status, body?.error?.message);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new ExtractError('invalid_output', 'The model returned an empty response. Try again.');
  return content;
};

function toExtractError(status: number, message = ''): ExtractError {
  switch (status) {
    case 401:
      return new ExtractError('bad_key', 'OpenRouter rejected your API key. Check it in the options.');
    case 402:
      return new ExtractError('no_credits', 'OpenRouter says this request needs credits. Pick a :free model.');
    case 429:
      return new ExtractError(
        'rate_limited',
        'Free model limit reached (50/day, or 1000/day after buying $10 of OpenRouter credits). Try again later.',
      );
    case 404:
      return new ExtractError(
        'model_unavailable',
        'No available provider supports structured output for this model. Choose a different one in the options.',
      );
    default:
      return new ExtractError('api', `OpenRouter error${status ? ` ${status}` : ''}: ${message || 'unknown error'}`);
  }
}
