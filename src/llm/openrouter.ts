import { extractionJsonSchema, extractionSchema, type CalendarEvent } from '../schema';
import { SYSTEM_PROMPT, buildUserMessage, type PromptContext } from './prompt';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export type ExtractErrorCode =
  | 'no_key'
  | 'bad_key'
  | 'rate_limited'
  | 'no_credits'
  | 'model_unavailable'
  | 'invalid_output'
  | 'network'
  | 'api';

export class ExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExtractError';
  }
}

export interface ExtractOptions extends PromptContext {
  apiKey: string;
  model: string;
  fallbackModels: string[];
  fetchImpl?: typeof fetch;
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export async function extractEvents(options: ExtractOptions): Promise<CalendarEvent[]> {
  if (!options.apiKey.trim()) {
    throw new ExtractError('no_key', 'Add your OpenRouter API key in the extension options.');
  }

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(options) },
  ];

  const first = await complete(options, messages);
  const firstResult = parseExtraction(first);
  if (firstResult.ok) return firstResult.events;

  // One repair attempt with the validation error fed back.
  messages.push(
    { role: 'assistant', content: first },
    {
      role: 'user',
      content: `That response was invalid: ${firstResult.error}. Reply again with only JSON matching the schema.`,
    },
  );
  const retryResult = parseExtraction(await complete(options, messages));
  if (retryResult.ok) return retryResult.events;
  throw new ExtractError('invalid_output', 'The model returned unusable output. Try again or pick another model.');
}

export function parseExtraction(
  content: string,
): { ok: true; events: CalendarEvent[] } | { ok: false; error: string } {
  const json = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  const result = extractionSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, events: result.data.events };
}

async function complete(options: ExtractOptions, messages: Message[]): Promise<string> {
  const models = [options.model, ...options.fallbackModels].map((m) => m.trim()).filter(Boolean);
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
        model: models[0],
        models,
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
}

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
        'No available provider supports structured output for these models. Choose different models in the options.',
      );
    default:
      return new ExtractError('api', `OpenRouter error${status ? ` ${status}` : ''}: ${message || 'unknown error'}`);
  }
}
