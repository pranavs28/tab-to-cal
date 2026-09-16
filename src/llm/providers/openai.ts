import { extractionJsonSchema } from '../../schema';
import { ExtractError } from '../errors';
import type { CompleteFn } from './types';

const ENDPOINT = 'https://api.openai.com/v1/responses';

interface ResponsesOutputItem {
  type: string;
  role?: string;
  content?: { type: string; text?: string }[];
}

export const completeOpenAI: CompleteFn = async (options, messages) => {
  const fetchImpl = options.fetchImpl ?? fetch;

  // The Responses API takes "developer" instead of "system" for instructions.
  const input = messages.map((m) => ({
    type: 'message',
    role: m.role === 'system' ? 'developer' : m.role,
    content: m.content,
  }));

  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        input,
        temperature: 0,
        text: {
          format: { type: 'json_schema', name: 'calendar_events', schema: extractionJsonSchema, strict: true },
        },
      }),
    });
  } catch {
    throw new ExtractError('network', 'Could not reach OpenAI. Check your connection.');
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    output?: ResponsesOutputItem[];
  } | null;

  if (!response.ok || body?.error) {
    throw toExtractError(response.status, body?.error?.message);
  }

  const message = body?.output?.find((item) => item.type === 'message');
  const text = message?.content?.find((c) => c.type === 'output_text')?.text;
  if (!text) throw new ExtractError('invalid_output', 'The model returned an empty response. Try again.');
  return text;
};

function toExtractError(status: number, message = ''): ExtractError {
  switch (status) {
    case 401:
      return new ExtractError('bad_key', 'OpenAI rejected your API key. Check it in the options.');
    case 402:
    case 429:
      return new ExtractError(
        'rate_limited',
        'OpenAI rate-limited this request (or your account is out of quota). Try again later or check your OpenAI billing.',
      );
    case 404:
      return new ExtractError('model_unavailable', 'That model id was not found. Check it in the options.');
    default:
      return new ExtractError('api', `OpenAI error${status ? ` ${status}` : ''}: ${message || 'unknown error'}`);
  }
}
