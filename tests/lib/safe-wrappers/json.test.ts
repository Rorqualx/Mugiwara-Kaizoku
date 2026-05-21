/**
 * Safe JSON Parsing Utilities Test Suite
 *
 * Comprehensive tests for all JSON parsing and stringification utilities
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import {
  safeJSONParse,
  safeJSONParseWithSchema,
  safeJSONParseWithDetailedErrors,
  safeStringify,
  safeStringifyWithResult,
  parseJSONOrDefault,
  parseJSONWithSchemaOrDefault,
  parseJSONOrNull,
  parseJSONWithSchemaOrNull,
  isParseSuccess,
  isParseFailure,
  parseManyJSON,
  parseNestedJSON,
  parseJSONFromBuffer,
} from '@/lib/safe-wrappers/json';

// Test schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const MangaSchema = z.object({
  title: z.string(),
  chapters: z.number().optional(),
  status: z.enum(['ONGOING', 'COMPLETED']).optional(),
});

// ============================================================================
// Basic JSON Parsing Tests
// ============================================================================

describe('safeJSONParse', () => {
  it('should parse valid JSON successfully', () => {
    const result = safeJSONParse('{"title": "Test"}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'Test' });
    }
  });

  it('should parse arrays', () => {
    const result = safeJSONParse('[1, 2, 3]');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3]);
    }
  });

  it('should parse primitives', () => {
    const result1 = safeJSONParse('42');
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.data).toBe(42);
    }

    const result2 = safeJSONParse('"string"');
    expect(result2.success).toBe(true);
    if (result2.success) {
      expect(result2.data).toBe('string');
    }

    const result3 = safeJSONParse('true');
    expect(result3.success).toBe(true);
    if (result3.success) {
      expect(result3.data).toBe(true);
    }
  });

  it('should return error for invalid JSON', () => {
    const result = safeJSONParse('invalid json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should return error for incomplete JSON', () => {
    const result = safeJSONParse('{"title": "Test"');
    expect(result.success).toBe(false);
  });

  it('should handle null and undefined JSON values', () => {
    const result1 = safeJSONParse('null');
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.data).toBe(null);
    }
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('safeJSONParseWithSchema', () => {
  it('should parse and validate valid data', () => {
    const json = '{"id": 1, "name": "John", "email": "john@example.com"}';
    const result = safeJSONParseWithSchema(json, UserSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe('John');
      expect(result.data.email).toBe('john@example.com');
    }
  });

  it('should fail for invalid schema', () => {
    const json = '{"id": "not-a-number", "name": "John", "email": "john@example.com"}';
    const result = safeJSONParseWithSchema(json, UserSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should fail for missing required fields', () => {
    const json = '{"id": 1}';
    const result = safeJSONParseWithSchema(json, UserSchema);

    expect(result.success).toBe(false);
  });

  it('should fail for invalid email', () => {
    const json = '{"id": 1, "name": "John", "email": "not-an-email"}';
    const result = safeJSONParseWithSchema(json, UserSchema);

    expect(result.success).toBe(false);
  });

  it('should handle optional fields', () => {
    const json = '{"title": "One Piece"}';
    const result = safeJSONParseWithSchema(json, MangaSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('One Piece');
      expect(result.data.chapters).toBeUndefined();
    }
  });

  it('should validate enum values', () => {
    const validJson = '{"title": "Naruto", "status": "COMPLETED"}';
    const invalidJson = '{"title": "Naruto", "status": "INVALID"}';

    const validResult = safeJSONParseWithSchema(validJson, MangaSchema);
    expect(validResult.success).toBe(true);

    const invalidResult = safeJSONParseWithSchema(invalidJson, MangaSchema);
    expect(invalidResult.success).toBe(false);
  });
});

describe('safeJSONParseWithDetailedErrors', () => {
  it('should provide detailed error information', () => {
    const json = '{"id": "not-a-number", "name": "John"}';
    const result = safeJSONParseWithDetailedErrors(json, UserSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.zodError).toBeDefined();
    }
  });

  it('should succeed for valid data', () => {
    const json = '{"id": 1, "name": "John", "email": "john@example.com"}';
    const result = safeJSONParseWithDetailedErrors(json, UserSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(1);
    }
  });

  it('should handle parse errors', () => {
    const json = 'invalid json';
    const result = safeJSONParseWithDetailedErrors(json, UserSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.issues).toBeUndefined();
    }
  });
});

// ============================================================================
// JSON Stringification Tests
// ============================================================================

describe('safeStringify', () => {
  it('should stringify objects', () => {
    const obj = { title: 'Test', count: 42 };
    const result = safeStringify(obj);
    expect(result).toBe('{"title":"Test","count":42}');
  });

  it('should stringify arrays', () => {
    const arr = [1, 2, 3];
    const result = safeStringify(arr);
    expect(result).toBe('[1,2,3]');
  });

  it('should stringify primitives', () => {
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify('string')).toBe('"string"');
    expect(safeStringify(true)).toBe('true');
    expect(safeStringify(null)).toBe('null');
  });

  it('should format with indentation when pretty=true', () => {
    const obj = { title: 'Test' };
    const result = safeStringify(obj, true);
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('should return empty string for circular references', () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    const result = safeStringify(obj);
    expect(result).toBe('');
  });
});

describe('safeStringifyWithResult', () => {
  it('should return success result for valid data', () => {
    const obj = { title: 'Test' };
    const result = safeStringifyWithResult(obj);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('{"title":"Test"}');
    }
  });

  it('should return error result for circular references', () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    const result = safeStringifyWithResult(obj);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('parseJSONOrDefault', () => {
  it('should return parsed data for valid JSON', () => {
    const result = parseJSONOrDefault('{"title": "Test"}', { title: 'Default' });
    expect(result).toEqual({ title: 'Test' });
  });

  it('should return default for invalid JSON', () => {
    const defaultValue = { title: 'Default' };
    const result = parseJSONOrDefault('invalid', defaultValue);
    expect(result).toBe(defaultValue);
  });
});

describe('parseJSONWithSchemaOrDefault', () => {
  it('should return validated data for valid JSON', () => {
    const json = '{"title": "One Piece"}';
    const defaultValue = { title: 'Default' };
    const result = parseJSONWithSchemaOrDefault(json, MangaSchema, defaultValue);
    expect(result.title).toBe('One Piece');
  });

  it('should return default for invalid JSON', () => {
    const defaultValue = { title: 'Default' };
    const result = parseJSONWithSchemaOrDefault('invalid', MangaSchema, defaultValue);
    expect(result).toBe(defaultValue);
  });

  it('should return default for schema validation failure', () => {
    const json = '{"title": 123}'; // Invalid: title should be string
    const defaultValue = { title: 'Default' };
    const result = parseJSONWithSchemaOrDefault(json, MangaSchema, defaultValue);
    expect(result).toBe(defaultValue);
  });
});

describe('parseJSONOrNull', () => {
  it('should return parsed data for valid JSON', () => {
    const result = parseJSONOrNull('{"title": "Test"}');
    expect(result).toEqual({ title: 'Test' });
  });

  it('should return null for invalid JSON', () => {
    const result = parseJSONOrNull('invalid');
    expect(result).toBe(null);
  });
});

describe('parseJSONWithSchemaOrNull', () => {
  it('should return validated data for valid JSON', () => {
    const json = '{"title": "One Piece"}';
    const result = parseJSONWithSchemaOrNull(json, MangaSchema);
    expect(result).not.toBe(null);
    expect(result?.title).toBe('One Piece');
  });

  it('should return null for invalid JSON', () => {
    const result = parseJSONWithSchemaOrNull('invalid', MangaSchema);
    expect(result).toBe(null);
  });

  it('should return null for schema validation failure', () => {
    const json = '{"title": 123}';
    const result = parseJSONWithSchemaOrNull(json, MangaSchema);
    expect(result).toBe(null);
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isParseSuccess', () => {
  it('should return true for success results', () => {
    const result = safeJSONParse('{"test": true}');
    expect(isParseSuccess(result)).toBe(true);
  });

  it('should return false for failure results', () => {
    const result = safeJSONParse('invalid');
    expect(isParseSuccess(result)).toBe(false);
  });
});

describe('isParseFailure', () => {
  it('should return true for failure results', () => {
    const result = safeJSONParse('invalid');
    expect(isParseFailure(result)).toBe(true);
  });

  it('should return false for success results', () => {
    const result = safeJSONParse('{"test": true}');
    expect(isParseFailure(result)).toBe(false);
  });
});

// ============================================================================
// Advanced Parsing Tests
// ============================================================================

describe('parseManyJSON', () => {
  it('should parse multiple JSON strings', () => {
    const jsons = ['{"a": 1}', '{"b": 2}', '{"c": 3}'];
    const results = parseManyJSON(jsons);

    expect(results).toHaveLength(3);
    expect(results.every(isParseSuccess)).toBe(true);
  });

  it('should handle mixed valid and invalid JSON', () => {
    const jsons = ['{"a": 1}', 'invalid', '{"c": 3}'];
    const results = parseManyJSON(jsons);

    expect(results).toHaveLength(3);
    expect(isParseSuccess(results[0]!)).toBe(true);
    expect(isParseSuccess(results[1]!)).toBe(false);
    expect(isParseSuccess(results[2]!)).toBe(true);
  });

  it('should handle empty array', () => {
    const results = parseManyJSON([]);
    expect(results).toHaveLength(0);
  });
});

describe('parseNestedJSON', () => {
  it('should parse nested JSON strings', () => {
    const nested = '{"data": "{\\"nested\\": true}"}';
    const result = parseNestedJSON(nested, 2);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data).toBe('object');
    }
  });

  it('should stop at specified depth', () => {
    const tripleNested = '{"a": "{\\"b\\": \\"{\\\\\\"c\\\\\\": true}\\"}"}';
    const result = parseNestedJSON(tripleNested, 2);

    expect(result.success).toBe(true);
    // Should parse two levels
  });

  it('should handle non-nested JSON', () => {
    const simple = '{"data": 123}';
    const result = parseNestedJSON(simple, 2);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ data: 123 });
    }
  });
});

describe('parseJSONFromBuffer', () => {
  it('should parse JSON from Buffer', () => {
    const buffer = Buffer.from('{"title": "Test"}');
    const result = parseJSONFromBuffer(buffer);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'Test' });
    }
  });

  it('should handle different encodings', () => {
    const buffer = Buffer.from('{"title": "Test"}', 'utf-8');
    const result = parseJSONFromBuffer(buffer, 'utf-8');

    expect(result.success).toBe(true);
  });

  it('should return error for invalid JSON in Buffer', () => {
    const buffer = Buffer.from('invalid json');
    const result = parseJSONFromBuffer(buffer);

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge cases', () => {
  it('should handle empty strings', () => {
    const result = safeJSONParse('');
    expect(result.success).toBe(false);
  });

  it('should handle whitespace-only strings', () => {
    const result = safeJSONParse('   ');
    expect(result.success).toBe(false);
  });

  it('should handle very large JSON', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);
    const json = JSON.stringify(largeArray);
    const result = safeJSONParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    }
  });

  it('should handle deeply nested objects', () => {
    let nested: { nested?: unknown } = {};
    let current = nested;
    for (let i = 0; i < 100; i++) {
      current.nested = {};
      current = current.nested as { nested?: unknown };
    }

    const json = JSON.stringify(nested);
    const result = safeJSONParse(json);

    expect(result.success).toBe(true);
  });

  it('should handle special characters', () => {
    const obj = { text: 'Special chars: "quotes", \\backslash, /slash' };
    const json = JSON.stringify(obj);
    const result = safeJSONParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(obj);
    }
  });

  it('should handle unicode characters', () => {
    const obj = { text: '日本語 中文 한글 🎌' };
    const json = JSON.stringify(obj);
    const result = safeJSONParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(obj);
    }
  });
});
