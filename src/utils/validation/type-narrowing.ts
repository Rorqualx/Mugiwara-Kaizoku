/**
 * Type Narrowing Utilities
 *
 * This module provides utilities for narrowing types at runtime,
 * providing a bridge between TypeScript's static type system and
 * runtime type checking.
 */
import { ValidationError } from '@/utils/errors';

import * as TypeGuards from './type-guards';
/**
 * Narrows a value to a specific type using a type guard
 *
 * @template T - The target type
 * @param value - The value to narrow
 * @param typeGuard - Type guard function to check the value
 * @returns The value as type T if it passes the type guard, null otherwise
 *
 * @example
 * ```ts
 * const data: unknown = getDataFromSomewhere();
 * const user = narrowType<User>(data, isUser);
 *
 * if (user) {
 *   // user is of type User here
 *   logger.info(`User: ${user["name"]}`);
 * } else {
 *   console.error('Data is not a valid user');
 * }
 * ```
 */
export function narrowType<T>(value: unknown, typeGuard: (value: unknown) => value is T): T | null {
    if (typeGuard(value)) {
        return value;
    }
    return null;
}
/**
 * Narrows a value to a specific type with a fallback
 *
 * @template T - The target type
 * @template F - The fallback type
 * @param value - The value to narrow
 * @param typeGuard - Type guard function to check the value
 * @param fallback - Fallback value if type guard fails
 * @returns The value as type T if it passes the type guard, otherwise the fallback value
 *
 * @example
 * ```ts
 * const data: unknown = getDataFromSomewhere();
 * const user = narrowWithFallback<User, EmptyUser>(
 *   data,
 *   isUser,
 *   { id: 0, name: 'Unknown', email: '' }
 * );
 *
 * // user is guaranteed to be either a valid User or the EmptyUser
 * logger.info(`User: ${user["name"]}`);
 * ```
 */
export function narrowWithFallback<T, F>(value: unknown, typeGuard: (value: unknown) => value is T, fallback: F): T | F {
    if (typeGuard(value)) {
        return value;
    }
    return fallback;
}
/**
 * Safely narrows a value to a specific type or returns undefined
 *
 * @template T - The target type
 * @param value - The value to narrow
 * @param typeGuard - Type guard function to check the value
 * @returns The value as type T if it passes the type guard, undefined otherwise
 *
 * @example
 * ```ts
 * const data: unknown = getDataFromSomewhere();
 * const user = safeNarrow<User>(data, isUser);
 *
 * if (user) {
 *   // user is of type User here
 *   logger.info(`User: ${user["name"]}`);
 * } else {
 *   console.error('Data is not a valid user');
 * }
 * ```
 */
export function safeNarrow<T>(value: unknown, typeGuard: (value: unknown) => value is T): T | undefined {
    if (typeGuard(value)) {
        return value;
    }
    return undefined;
}
/**
 * Narrows a value to a string or returns a default value
 *
 * @param value - The value to narrow
 * @param defaultValue - Default value if the value is not a string
 * @returns The value as string if it is a string, otherwise the default value
 */
export function narrowToString(value: unknown, defaultValue: string = ''): string {
    return TypeGuards.isString(value) ? value : defaultValue;
}
/**
 * Narrows a value to a number or returns a default value
 *
 * @param value - The value to narrow
 * @param defaultValue - Default value if the value is not a number
 * @returns The value as number if it is a number, otherwise the default value
 */
export function narrowToNumber(value: unknown, defaultValue: number = 0): number {
    return TypeGuards.isNumber(value) ? value : defaultValue;
}
/**
 * Narrows a value to a boolean or returns a default value
 *
 * @param value - The value to narrow
 * @param defaultValue - Default value if the value is not a boolean
 * @returns The value as boolean if it is a boolean, otherwise the default value
 */
export function narrowToBoolean(value: unknown, defaultValue: boolean = false): boolean {
    return TypeGuards.isBoolean(value) ? value : defaultValue;
}
/**
 * Narrows a value to an array or returns a default value
 *
 * @template T - The array element type
 * @param value - The value to narrow
 * @param itemTypeGuard - Type guard function to check each array item
 * @param defaultValue - Default value if the value is not an array of type T
 * @returns The value as T[] if it is an array of T, otherwise the default value
 */
export function narrowToArray<T>(value: unknown, itemTypeGuard: (item: unknown) => item is T, defaultValue: T[] = []): T[] {
    if (TypeGuards.isArray(value) && value.every(itemTypeGuard)) {
        return value as T[];
    }
    return defaultValue;
}
/**
 * Narrows a value to a record or returns a default value
 *
 * @template T - The record value type
 * @param value - The value to narrow
 * @param valueTypeGuard - Type guard function to check each record value
 * @param defaultValue - Default value if the value is not a record of type T
 * @returns The value as Record<string, T> if it is a record of T, otherwise the default value
 */
export function narrowToRecord<T>(value: unknown, valueTypeGuard: (value: unknown) => value is T, defaultValue: Record<string, T> = {} as Record<string, T>): Record<string, T> {
    if (TypeGuards.isObject(value) && Object.values(value).every(valueTypeGuard)) {
        return value as Record<string, T>;
    }
    return defaultValue;
}
/**
 * Ensures a value is of the expected type or throws an error
 *
 * @template T - The expected type
 * @param value - The value to check
 * @param typeGuard - Type guard function to check the value
 * @param errorMessage - Error message if the value is not of type T
 * @returns The value as type T if it passes the type guard
 * @throws Error if the value does not pass the type guard
 *
 * @example
 * ```ts
 * // This will throw an error if the data is not a valid user
 * const user = ensureType<User>(
 *   data,
 *   isUser,
 *   'Invalid user data'
 * );
 *
 * // user is guaranteed to be a valid User here
 * logger.info(`User: ${user["name"]}`);
 * ```
 */
export function ensureType<T>(value: unknown, typeGuard: (value: unknown) => value is T, errorMessage: string = 'Value is not of the expected type'): T {
    if (typeGuard(value)) {
        return value;
    }
    throw new ValidationError(errorMessage);
}
