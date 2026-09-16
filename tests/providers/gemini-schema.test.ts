import { describe, expect, it } from 'vitest';
import { toGeminiSchema } from '../../src/llm/providers/gemini-schema';

describe('toGeminiSchema', () => {
  it('converts a nullable type array into type + nullable', () => {
    expect(toGeminiSchema({ type: ['string', 'null'] })).toEqual({ type: 'string', nullable: true });
  });

  it('converts anyOf-with-null into the non-null branch plus nullable', () => {
    const input = { anyOf: [{ type: 'object', properties: { x: { type: 'string' } } }, { type: 'null' }] };
    expect(toGeminiSchema(input)).toEqual({
      type: 'object',
      properties: { x: { type: 'string' } },
      nullable: true,
    });
  });

  it('strips additionalProperties', () => {
    const result = toGeminiSchema({ type: 'object', additionalProperties: false, properties: {} }) as Record<
      string,
      unknown
    >;
    expect(result.additionalProperties).toBeUndefined();
  });

  it('recurses into nested properties and array items', () => {
    const input = {
      type: 'object',
      properties: {
        time: { type: ['string', 'null'] },
        items: { type: 'array', items: { type: ['string', 'null'] } },
      },
    };
    expect(toGeminiSchema(input)).toEqual({
      type: 'object',
      properties: {
        time: { type: 'string', nullable: true },
        items: { type: 'array', items: { type: 'string', nullable: true } },
      },
    });
  });

  it('leaves a plain non-nullable schema unchanged', () => {
    expect(toGeminiSchema({ type: 'string' })).toEqual({ type: 'string' });
  });
});
