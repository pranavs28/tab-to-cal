import { extractionJsonSchema } from '../../schema';
import { ExtractError } from '../errors';
import { toGeminiSchema } from './gemini-schema';
import type { CompleteFn } from './types';

export const completeGemini: CompleteFn = async (options, messages) => {
  const fetchImpl = options.fetchImpl ?? fetch;

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  // Gemini calls the assistant role "model", not "assistant".
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'x-goog-api-key': options.apiKey.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(extractionJsonSchema),
        },
      }),
    });
  } catch {
    throw new ExtractError('network', 'Could not reach Gemini. Check your connection.');
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: number };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;

  if (!response.ok || body?.error) {
    throw toExtractError(response.status, body?.error?.message);
  }

  const text = body?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('');
  if (!text) throw new ExtractError('invalid_output', 'The model returned an empty response. Try again.');
  return text;
};

function toExtractError(status: number, message = ''): ExtractError {
  switch (status) {
    case 401:
    case 403:
      return new ExtractError('bad_key', 'Gemini rejected your API key. Check it in the options.');
    case 429:
      return new ExtractError('rate_limited', 'Gemini rate-limited this request. Try again later.');
    case 404:
      return new ExtractError('model_unavailable', 'That model id was not found. Check it in the options.');
    default:
      return new ExtractError('api', `Gemini error${status ? ` ${status}` : ''}: ${message || 'unknown error'}`);
  }
}
