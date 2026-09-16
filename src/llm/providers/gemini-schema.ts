/**
 * Converts our nullable-via-type-array / anyOf JSON Schema into the dialect
 * Gemini's `responseSchema` accepts: a single `type` plus `nullable: true`,
 * no `additionalProperties`.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (schema == null || typeof schema !== 'object') return schema;
  const input = schema as Record<string, unknown>;

  let node: Record<string, unknown>;
  if (Array.isArray(input.anyOf)) {
    const options = input.anyOf as Record<string, unknown>[];
    const nonNull = options.find((s) => s?.type !== 'null') ?? {};
    const hasNull = options.some((s) => s?.type === 'null');
    node = { ...nonNull };
    if (hasNull) node.nullable = true;
  } else {
    node = { ...input };
  }

  if (Array.isArray(node.type)) {
    const types = node.type as string[];
    const hasNull = types.includes('null');
    node.type = types.filter((t) => t !== 'null')[0];
    if (hasNull) node.nullable = true;
  }

  delete node.additionalProperties;

  if (node.properties && typeof node.properties === 'object') {
    node.properties = Object.fromEntries(
      Object.entries(node.properties as Record<string, unknown>).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (node.items) node.items = toGeminiSchema(node.items);

  return node;
}
