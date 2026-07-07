import { z, type ZodTypeAny } from "zod";

/**
 * Minimal zod → JSON Schema converter for the subset we use in tool definitions.
 * Produces the shape Ollama expects for function calling: draft-07-ish with
 * type/properties/required/enum/description.
 *
 * We roll our own instead of pulling in zod-to-json-schema because:
 * - the subset we need is tiny (string, number, boolean, array, object, enum, optional)
 * - we want full control over the output (nullable handling, default semantics)
 * - zero extra dependencies
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

function convert(schema: ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName?: string; description?: string } & Record<string, unknown>;
  const description = (schema as { description?: string }).description;

  if (schema instanceof z.ZodString) {
    return withDesc({ type: "string" }, description);
  }
  if (schema instanceof z.ZodNumber) {
    return withDesc({ type: "number" }, description);
  }
  if (schema instanceof z.ZodBoolean) {
    return withDesc({ type: "boolean" }, description);
  }
  if (schema instanceof z.ZodEnum) {
    const values = (def as unknown as { values: readonly string[] }).values;
    return withDesc({ type: "string", enum: [...values] }, description);
  }
  if (schema instanceof z.ZodLiteral) {
    const value = (def as unknown as { value: unknown }).value;
    const t = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
    return withDesc({ type: t, enum: [value] }, description);
  }
  if (schema instanceof z.ZodArray) {
    const inner = (def as unknown as { type: ZodTypeAny }).type;
    return withDesc({ type: "array", items: convert(inner) }, description);
  }
  if (schema instanceof z.ZodObject) {
    const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convert(value);
      if (!isOptional(value)) required.push(key);
    }
    const result: Record<string, unknown> = {
      type: "object",
      properties,
    };
    if (required.length) result.required = required;
    return withDesc(result, description);
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    const inner = (def as unknown as { innerType: ZodTypeAny }).innerType;
    return convert(inner);
  }
  if (schema instanceof z.ZodNullable) {
    const inner = (def as unknown as { innerType: ZodTypeAny }).innerType;
    const conv = convert(inner);
    if (Array.isArray(conv.type)) return withDesc(conv, description);
    return withDesc({ ...conv, type: [conv.type, "null"] }, description);
  }
  if (schema instanceof z.ZodUnion) {
    const options = (def as unknown as { options: ZodTypeAny[] }).options;
    return withDesc({ anyOf: options.map(convert) }, description);
  }
  if (schema instanceof z.ZodRecord) {
    const value = (def as unknown as { valueType: ZodTypeAny }).valueType;
    return withDesc(
      { type: "object", additionalProperties: convert(value) },
      description
    );
  }
  // Fallback — any/unknown
  return withDesc({}, description);
}

function isOptional(schema: ZodTypeAny): boolean {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodDefault;
}

function withDesc(
  obj: Record<string, unknown>,
  description: string | undefined
): Record<string, unknown> {
  if (description) return { ...obj, description };
  return obj;
}
