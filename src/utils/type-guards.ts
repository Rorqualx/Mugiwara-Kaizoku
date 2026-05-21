/**
 * Type Guards for Unknown Types
 *
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please migrate to the centralized type guard location: @/utils/type-guards
 *
 * Provides type-safe checking for unknown values
 */

// Basic type guards
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFunction(value: unknown): value is (...args: unknown[]) => any {
  return typeof value === 'function';
}

// Error type guards
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function hasMessage(value: unknown): value is { message: string } {
  return isObject(value) && 'message' in value && isString((value as Record<string, unknown>)["message"]);
}

export function hasStack(value: unknown): value is { stack: string } {
  return isObject(value) && 'stack' in value && isString((value as Record<string, unknown>)["stack"]);
}

// Event type guards
export interface ProgressEvent {
  loaded: number;
  total: number;
  lengthComputable: boolean;
}

export function isProgressEvent(value: unknown): value is ProgressEvent {
  return isObject(value) &&
    'loaded' in value && isNumber((value as Record<string, unknown>)["loaded"]) &&
    'total' in value && isNumber((value as Record<string, unknown>)["total"]);
}

export interface MessageEvent {
  data: unknown;
  origin?: string;
  source?: unknown;
}

export function isMessageEvent(value: unknown): value is MessageEvent {
  return isObject(value) && 'data' in value;
}

// React type guards
export function isReactNode(value: unknown): boolean {
  return value === null ||
    value === undefined ||
    isString(value) ||
    isNumber(value) ||
    isBoolean(value) ||
    (isObject(value) && '$$typeof' in value);
}

// Safe property access
export function getProperty<T>(
  obj: unknown,
  key: string,
  defaultValue: T
): T {
  if (!isObject(obj)) return defaultValue;
  const value = (obj as Record<string, unknown>)[key];
  return value as T ?? defaultValue;
}

export function hasProperty(
  obj: unknown,
  key: string
): obj is Record<string, unknown> {
  return isObject(obj) && key in obj;
}

// Safe casting helpers
export function asString(value: unknown, defaultValue = ''): string {
  return isString(value) ? value : defaultValue;
}

export function asNumber(value: unknown, defaultValue = 0): number {
  return isNumber(value) ? value : defaultValue;
}

export function asBoolean(value: unknown, defaultValue = false): boolean {
  return isBoolean(value) ? value : defaultValue;
}

export function asArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return isArray(value) ? value as T[] : defaultValue;
}

export function asObject<T extends Record<string, unknown>>(
  value: unknown,
  defaultValue: T
): T {
  return isObject(value) ? value as T : defaultValue;
}

// Error handling helpers
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (hasMessage(error)) return error.message;
  if (isString(error)) return error;
  return 'An unknown error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) return error.stack;
  if (hasStack(error)) return error.stack;
  return undefined;
}

// Validation helpers
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is null or undefined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

export function assertString(
  value: unknown,
  message = 'Value is not a string'
): asserts value is string {
  if (!isString(value)) {
    throw new Error(message);
  }
}

export function assertNumber(
  value: unknown,
  message = 'Value is not a number'
): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(message);
  }
}

export function assertObject(
  value: unknown,
  message = 'Value is not an object'
): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(message);
  }
}

// Additional type guards for compatibility
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    isObject(value) &&
    'then' in value &&
    typeof (value as Record<string, unknown>)["then"] === 'function' &&
    'catch' in value &&
    typeof (value as Record<string, unknown>)["catch"] === 'function'
  );
}

export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(guard);
}

export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

export function isNumberArray(value: unknown): value is number[] {
  return isArrayOf(value, isNumber);
}

export function hasPropertyOfType<K extends string, T>(
  obj: unknown,
  key: K,
  guard: (value: unknown) => value is T
): obj is Record<K, T> {
  return hasProperty(obj, key) && guard(obj[key]);
}

export function hasRequiredProperties<K extends string>(
  obj: unknown,
  keys: K[]
): obj is Record<K, unknown> {
  return isObject(obj) && keys.every(key => key in obj);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === null || proto === Object.prototype;
}

export function isEnum<T extends Record<string, string | number>>(
  value: unknown,
  enumObj: T
): value is T[keyof T] {
  return Object.values(enumObj).includes(value as string | number);
}

export function isTruthy<T>(value: T | null | undefined | false | 0 | ''): value is T {
  return Boolean(value);
}

export function isFalsy(value: unknown): value is null | undefined | false | 0 | '' {
  return !value;
}

export default {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isNull,
  isUndefined,
  isNullish,
  isFunction,
  isError,
  hasMessage,
  hasStack,
  isProgressEvent,
  isMessageEvent,
  isReactNode,
  getProperty,
  hasProperty,
  asString,
  asNumber,
  asBoolean,
  asArray,
  asObject,
  getErrorMessage,
  getErrorStack,
  assertDefined,
  assertString,
  assertNumber,
  assertObject,
  // Additional exports
  isDefined,
  isNotNull,
  isPresent,
  isNonEmptyString,
  isDate,
  isPromise,
  isArrayOf,
  isStringArray,
  isNumberArray,
  hasPropertyOfType,
  hasRequiredProperties,
  isPlainObject,
  isEnum,
  isTruthy,
  isFalsy,
};
