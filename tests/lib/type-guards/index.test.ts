/**
 * Type Guard Utilities Test Suite
 *
 * Comprehensive tests for all type guard functions to ensure correct
 * type narrowing and runtime validation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  hasProperty,
  hasProperties,
  isRecord,
  isStringRecord,
  isNumberRecord,
  isBooleanRecord,
  isStringArray,
  isNumberArray,
  isBooleanArray,
  isRecordArray,
  isError,
  getErrorMessage,
  getErrorStack,
  hasTitle,
  hasId,
  hasIdAndTitle,
  hasName,
  hasDescription,
  isDefined,
  isNullish,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  isInteger,
  isValidUrl,
  isValidDate,
  isFunction,
} from '@/lib/type-guards';

// ============================================================================
// Property Checking Tests
// ============================================================================

describe('hasProperty', () => {
  it('should return true for object with the property', () => {
    const obj = { title: 'Test', count: 42 };
    expect(hasProperty(obj, 'title')).toBe(true);
    expect(hasProperty(obj, 'count')).toBe(true);
  });

  it('should return false for object without the property', () => {
    const obj = { title: 'Test' };
    expect(hasProperty(obj, 'description')).toBe(false);
  });

  it('should return false for null', () => {
    expect(hasProperty(null, 'title')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(hasProperty(undefined, 'title')).toBe(false);
  });

  it('should return false for primitive types', () => {
    expect(hasProperty('string', 'length')).toBe(false);
    expect(hasProperty(42, 'toString')).toBe(false);
    expect(hasProperty(true, 'valueOf')).toBe(false);
  });

  it('should handle properties with falsy values', () => {
    const obj = { zero: 0, empty: '', isFalse: false, isNull: null };
    expect(hasProperty(obj, 'zero')).toBe(true);
    expect(hasProperty(obj, 'empty')).toBe(true);
    expect(hasProperty(obj, 'isFalse')).toBe(true);
    expect(hasProperty(obj, 'isNull')).toBe(true);
  });
});

describe('hasProperties', () => {
  it('should return true when all properties exist', () => {
    const obj = { id: 1, title: 'Test', author: 'Author' };
    expect(hasProperties(obj, ['id', 'title'])).toBe(true);
    expect(hasProperties(obj, ['id', 'title', 'author'])).toBe(true);
  });

  it('should return false when any property is missing', () => {
    const obj = { id: 1, title: 'Test' };
    expect(hasProperties(obj, ['id', 'author'])).toBe(false);
    expect(hasProperties(obj, ['id', 'title', 'author'])).toBe(false);
  });

  it('should return true for empty array of properties', () => {
    const obj = { id: 1 };
    expect(hasProperties(obj, [])).toBe(true);
  });

  it('should return false for non-objects', () => {
    expect(hasProperties(null, ['id'])).toBe(false);
    expect(hasProperties(undefined, ['id'])).toBe(false);
    expect(hasProperties('string', ['length'])).toBe(false);
  });
});

// ============================================================================
// Record Type Tests
// ============================================================================

describe('isRecord', () => {
  it('should return true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'value' })).toBe(true);
    expect(isRecord({ nested: { key: 'value' } })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });

  it('should return true for object instances', () => {
    expect(isRecord(new Date())).toBe(true);
    expect(isRecord(new Error())).toBe(true);
  });
});

describe('isStringRecord', () => {
  it('should return true for string-to-string records', () => {
    expect(isStringRecord({ key: 'value', foo: 'bar' })).toBe(true);
    expect(isStringRecord({})).toBe(true);
  });

  it('should return false for records with non-string values', () => {
    expect(isStringRecord({ key: 'value', count: 42 })).toBe(false);
    expect(isStringRecord({ key: null })).toBe(false);
    expect(isStringRecord({ key: undefined })).toBe(false);
  });

  it('should return false for non-records', () => {
    expect(isStringRecord(null)).toBe(false);
    expect(isStringRecord([])).toBe(false);
  });
});

describe('isNumberRecord', () => {
  it('should return true for string-to-number records', () => {
    expect(isNumberRecord({ count: 42, total: 100 })).toBe(true);
    expect(isNumberRecord({})).toBe(true);
  });

  it('should return false for records with non-number values', () => {
    expect(isNumberRecord({ count: 42, title: 'test' })).toBe(false);
    expect(isNumberRecord({ count: null })).toBe(false);
  });

  it('should handle special number values', () => {
    expect(isNumberRecord({ zero: 0, negative: -1, float: 3.14 })).toBe(true);
    expect(isNumberRecord({ infinity: Infinity })).toBe(true);
    expect(isNumberRecord({ nan: NaN })).toBe(true);
  });
});

describe('isBooleanRecord', () => {
  it('should return true for string-to-boolean records', () => {
    expect(isBooleanRecord({ active: true, enabled: false })).toBe(true);
    expect(isBooleanRecord({})).toBe(true);
  });

  it('should return false for records with non-boolean values', () => {
    expect(isBooleanRecord({ active: true, count: 1 })).toBe(false);
    expect(isBooleanRecord({ active: 'true' })).toBe(false);
  });
});

// ============================================================================
// Array Type Tests
// ============================================================================

describe('isStringArray', () => {
  it('should return true for string arrays', () => {
    expect(isStringArray(['a', 'b', 'c'])).toBe(true);
    expect(isStringArray([])).toBe(true);
  });

  it('should return false for arrays with non-string elements', () => {
    expect(isStringArray(['a', 1, 'c'])).toBe(false);
    expect(isStringArray([1, 2, 3])).toBe(false);
  });

  it('should return false for non-arrays', () => {
    expect(isStringArray('string')).toBe(false);
    expect(isStringArray({ 0: 'a', length: 1 })).toBe(false);
  });
});

describe('isNumberArray', () => {
  it('should return true for number arrays', () => {
    expect(isNumberArray([1, 2, 3])).toBe(true);
    expect(isNumberArray([])).toBe(true);
  });

  it('should return false for arrays with non-number elements', () => {
    expect(isNumberArray([1, 'two', 3])).toBe(false);
    expect(isNumberArray(['1', '2'])).toBe(false);
  });

  it('should handle special number values', () => {
    expect(isNumberArray([0, -1, 3.14, Infinity, NaN])).toBe(true);
  });
});

describe('isBooleanArray', () => {
  it('should return true for boolean arrays', () => {
    expect(isBooleanArray([true, false, true])).toBe(true);
    expect(isBooleanArray([])).toBe(true);
  });

  it('should return false for arrays with non-boolean elements', () => {
    expect(isBooleanArray([true, 1, false])).toBe(false);
    expect(isBooleanArray([true, 'true'])).toBe(false);
  });
});

describe('isRecordArray', () => {
  it('should return true for arrays of objects', () => {
    expect(isRecordArray([{ id: 1 }, { id: 2 }])).toBe(true);
    expect(isRecordArray([])).toBe(true);
  });

  it('should return false for arrays with non-object elements', () => {
    expect(isRecordArray([{ id: 1 }, null])).toBe(false);
    expect(isRecordArray([{ id: 1 }, []])).toBe(false);
    expect(isRecordArray([1, 2, 3])).toBe(false);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('isError', () => {
  it('should return true for Error instances', () => {
    expect(isError(new Error('test'))).toBe(true);
    expect(isError(new TypeError('test'))).toBe(true);
    expect(isError(new RangeError('test'))).toBe(true);
  });

  it('should return false for error-like objects', () => {
    expect(isError({ message: 'error', stack: 'stack' })).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isError('error')).toBe(false);
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should extract message from Error instances', () => {
    expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
  });

  it('should return string errors as-is', () => {
    expect(getErrorMessage('String error')).toBe('String error');
  });

  it('should extract message from error-like objects', () => {
    expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
  });

  it('should convert other types to strings', () => {
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});

describe('getErrorStack', () => {
  it('should extract stack from Error instances', () => {
    const error = new Error('Test');
    expect(getErrorStack(error)).toBeDefined();
    expect(typeof getErrorStack(error)).toBe('string');
  });

  it('should extract stack from error-like objects', () => {
    expect(getErrorStack({ stack: 'custom stack' })).toBe('custom stack');
  });

  it('should return undefined for values without stack', () => {
    expect(getErrorStack('error')).toBeUndefined();
    expect(getErrorStack({})).toBeUndefined();
    expect(getErrorStack(null)).toBeUndefined();
  });
});

// ============================================================================
// Common Structure Tests
// ============================================================================

describe('hasTitle', () => {
  it('should return true for objects with string title', () => {
    expect(hasTitle({ title: 'Test' })).toBe(true);
  });

  it('should return false for objects with non-string title', () => {
    expect(hasTitle({ title: 123 })).toBe(false);
    expect(hasTitle({ title: null })).toBe(false);
  });

  it('should return false for objects without title', () => {
    expect(hasTitle({ name: 'Test' })).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(hasTitle(null)).toBe(false);
    expect(hasTitle('title')).toBe(false);
  });
});

describe('hasId', () => {
  it('should return true for objects with number id', () => {
    expect(hasId({ id: 1 })).toBe(true);
  });

  it('should return true for objects with string id', () => {
    expect(hasId({ id: 'abc-123' })).toBe(true);
  });

  it('should return false for objects with other id types', () => {
    expect(hasId({ id: null })).toBe(false);
    expect(hasId({ id: {} })).toBe(false);
  });

  it('should return false for objects without id', () => {
    expect(hasId({ name: 'Test' })).toBe(false);
  });
});

describe('hasIdAndTitle', () => {
  it('should return true for objects with both id and title', () => {
    expect(hasIdAndTitle({ id: 1, title: 'Test' })).toBe(true);
    expect(hasIdAndTitle({ id: 'abc', title: 'Test' })).toBe(true);
  });

  it('should return false for objects with only id', () => {
    expect(hasIdAndTitle({ id: 1 })).toBe(false);
  });

  it('should return false for objects with only title', () => {
    expect(hasIdAndTitle({ title: 'Test' })).toBe(false);
  });
});

describe('hasName', () => {
  it('should return true for objects with string name', () => {
    expect(hasName({ name: 'Test' })).toBe(true);
  });

  it('should return false for objects with non-string name', () => {
    expect(hasName({ name: 123 })).toBe(false);
  });

  it('should return false for objects without name', () => {
    expect(hasName({ title: 'Test' })).toBe(false);
  });
});

describe('hasDescription', () => {
  it('should return true for objects with string description', () => {
    expect(hasDescription({ description: 'Test description' })).toBe(true);
  });

  it('should return false for objects with non-string description', () => {
    expect(hasDescription({ description: 123 })).toBe(false);
  });

  it('should return false for objects without description', () => {
    expect(hasDescription({ title: 'Test' })).toBe(false);
  });
});

// ============================================================================
// Nullability Tests
// ============================================================================

describe('isDefined', () => {
  it('should return true for defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined({})).toBe(true);
    expect(isDefined([])).toBe(true);
  });

  it('should return false for null', () => {
    expect(isDefined(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });

  it('should work as array filter', () => {
    const arr = [1, null, 2, undefined, 3];
    const filtered = arr.filter(isDefined);
    expect(filtered).toEqual([1, 2, 3]);
  });
});

describe('isNullish', () => {
  it('should return true for null', () => {
    expect(isNullish(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isNullish(undefined)).toBe(true);
  });

  it('should return false for other values', () => {
    expect(isNullish(0)).toBe(false);
    expect(isNullish('')).toBe(false);
    expect(isNullish(false)).toBe(false);
    expect(isNullish({})).toBe(false);
  });
});

// ============================================================================
// Primitive Type Tests
// ============================================================================

describe('isNonEmptyString', () => {
  it('should return true for non-empty strings', () => {
    expect(isNonEmptyString('test')).toBe(true);
    expect(isNonEmptyString(' ')).toBe(true);
  });

  it('should return false for empty strings', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('should return true for positive numbers', () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(0.1)).toBe(true);
    expect(isPositiveNumber(Infinity)).toBe(true);
  });

  it('should return false for zero', () => {
    expect(isPositiveNumber(0)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(-Infinity)).toBe(false);
  });

  it('should return false for NaN', () => {
    expect(isPositiveNumber(NaN)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isPositiveNumber('1')).toBe(false);
  });
});

describe('isNonNegativeNumber', () => {
  it('should return true for positive numbers', () => {
    expect(isNonNegativeNumber(1)).toBe(true);
    expect(isNonNegativeNumber(0.1)).toBe(true);
  });

  it('should return true for zero', () => {
    expect(isNonNegativeNumber(0)).toBe(true);
  });

  it('should return false for negative numbers', () => {
    expect(isNonNegativeNumber(-1)).toBe(false);
  });

  it('should return false for NaN', () => {
    expect(isNonNegativeNumber(NaN)).toBe(false);
  });
});

describe('isInteger', () => {
  it('should return true for integers', () => {
    expect(isInteger(0)).toBe(true);
    expect(isInteger(42)).toBe(true);
    expect(isInteger(-5)).toBe(true);
  });

  it('should return false for floats', () => {
    expect(isInteger(3.14)).toBe(false);
    expect(isInteger(0.1)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isInteger('42')).toBe(false);
    expect(isInteger(NaN)).toBe(false);
  });
});

// ============================================================================
// URL and Date Tests
// ============================================================================

describe('isValidUrl', () => {
  it('should return true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('ftp://files.example.com')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
    expect(isValidUrl(123)).toBe(false);
  });
});

describe('isValidDate', () => {
  it('should return true for valid dates', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date('2023-01-01'))).toBe(true);
  });

  it('should return false for invalid dates', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false);
  });

  it('should return false for non-dates', () => {
    expect(isValidDate('2023-01-01')).toBe(false);
    expect(isValidDate(1234567890)).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});

// ============================================================================
// Function Tests
// ============================================================================

describe('isFunction', () => {
  it('should return true for functions', () => {
    expect(isFunction(() => {})).toBe(true);
    expect(isFunction(function () {})).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    expect(isFunction(async function () {})).toBe(true);
  });

  it('should return true for class constructors', () => {
    class TestClass {}
    expect(isFunction(TestClass)).toBe(true);
  });

  it('should return false for non-functions', () => {
    expect(isFunction(null)).toBe(false);
    expect(isFunction(undefined)).toBe(false);
    expect(isFunction({})).toBe(false);
    expect(isFunction('function')).toBe(false);
  });
});
