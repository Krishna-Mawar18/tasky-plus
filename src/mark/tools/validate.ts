import type { JsonSchemaObject, JsonSchemaProperty } from '@/mark/types';

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; errors: string[] };

/**
 * Validate model-supplied tool arguments against the catalog's JSON schema.
 *
 * Hand-rolled so the project gains no runtime dependency, and deliberately
 * strict: no coercion, no extra properties, enums enforced. Provider output is
 * untrusted, so a tool is never executed on arguments that merely "look close".
 */
export function validateArguments(schema: JsonSchemaObject, input: unknown): ValidationResult {
  const errors: string[] = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['arguments must be a JSON object'] };
  }

  const record = input as Record<string, unknown>;
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  for (const key of required) {
    if (!(key in record) || record[key] === undefined || record[key] === null) {
      errors.push(`missing required property "${key}"`);
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in properties)) errors.push(`unexpected property "${key}"`);
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    const property = properties[key];
    if (!property) continue;
    const error = validateProperty(key, property, value);
    if (error) errors.push(error);
  }

  if (errors.length > 0) return { ok: false, errors };

  // Drop absent optional keys so a downstream executor sees only what was sent.
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(properties)) {
    if (record[key] !== undefined && record[key] !== null) clean[key] = record[key];
  }
  return { ok: true, value: clean };
}

function validateProperty(path: string, property: JsonSchemaProperty, value: unknown): string | null {
  switch (property.type) {
    case 'string': {
      if (typeof value !== 'string') return `"${path}" must be a string`;
      if (property.enum && !property.enum.includes(value)) {
        return `"${path}" must be one of: ${property.enum.join(', ')}`;
      }
      return null;
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `"${path}" must be a number`;
      if (property.type === 'integer' && !Number.isInteger(value)) return `"${path}" must be an integer`;
      if (property.minimum !== undefined && value < property.minimum) return `"${path}" is below the minimum`;
      if (property.maximum !== undefined && value > property.maximum) return `"${path}" exceeds the maximum`;
      return null;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return `"${path}" must be a boolean`;
      return null;
    }
    case 'array': {
      if (!Array.isArray(value)) return `"${path}" must be an array`;
      if (property.items) {
        for (let index = 0; index < value.length; index += 1) {
          const error = validateProperty(`${path}[${index}]`, property.items, value[index]);
          if (error) return error;
        }
      }
      return null;
    }
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return `"${path}" must be an object`;
      }
      return null;
    }
    default:
      return null;
  }
}
