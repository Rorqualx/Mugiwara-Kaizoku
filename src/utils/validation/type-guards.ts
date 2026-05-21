import { ValidationError } from '@/utils/errors';

/**
 * Type Guards for Validation
 * Central type guard utilities for runtime type checking
 *
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please migrate to the centralized type guard location: @/utils/type-guards
 */
/**
 * Check if value is defined (not null and not undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null;
}
/**
 * Check if value is not null
 */
export function isNotNull<T>(value: T | null): value is T {
    return value !== null;
}
/**
 * Check if value is not undefined
 */
export function isNotUndefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}
/**
 * Check if value is present (not null, not undefined, not empty string)
 */
export function isPresent(value: unknown): boolean {
    if (value === null)
        return false;
    if (typeof value === 'string')
        return value.trim().length > 0;
    if (Array.isArray(value))
        return value.length > 0;
    return true;
}
/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}
/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}
/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}
/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}
/**
 * Check if value is an object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Check if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!isObject(value))
        return false;
    const proto: unknown = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
/**
 * Check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}
/**
 * Check if value is an array of specific type
 */
export function isArrayOf<T>(value: unknown, itemGuard: (item: unknown) => item is T): value is T[] {
    return Array.isArray(value) && value.every(item => itemGuard(item));
}
/**
 * Check if value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
    return isArrayOf(value, isString);
}
/**
 * Check if value is a number array
 */
export function isNumberArray(value: unknown): value is number[] {
    return isArrayOf(value, isNumber);
}
/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
    return typeof value === 'function';
}
/**
 * Check if value is a Date
 */
export function isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
}
/**
 * Check if value is an Error
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}
/**
 * Check if value is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
    if (value instanceof Promise) return true;
    if (!isObject(value)) return false;
    const obj = value as Record<string, unknown>;
    return isFunction(obj['then']) && isFunction(obj['catch']);
}
/**
 * Check if an object has a property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
    return isObject(obj) && key in obj;
}
/**
 * Check if an object has a property of a specific type
 */
export function hasPropertyOfType<K extends string, T>(obj: unknown, key: K, typeGuard: (value: unknown) => value is T): obj is Record<K, T> {
    return hasProperty(obj, key) && typeGuard(obj[key]);
}
/**
 * Check if an object has all required properties
 */
export function hasRequiredProperties<K extends string>(obj: unknown, keys: K[]): obj is Record<K, unknown> {
    return isObject(obj) && keys.every(key => key in obj);
}
/**
 * Check if value is an enum value
 */
export function isEnum<T extends Record<string, string | number>>(value: unknown, enumObj: T): value is T[keyof T] {
    const enumValues = Object.values(enumObj) as unknown[];
    return enumValues.includes(value);
}
/**
 * Check if value is truthy
 */
export function isTruthy<T>(value: T | null | undefined | false | 0 | ''): value is T {
    return Boolean(value);
}
/**
 * Check if value is falsy
 */
export function isFalsy(value: unknown): value is null | undefined | false | 0 | '' {
    return !value;
}
/**
 * Assert that a value is never (exhaustive check)
 */
export function assertNever(value: never): never {
    throw new ValidationError(`Unexpected value: ${value}`);
}
