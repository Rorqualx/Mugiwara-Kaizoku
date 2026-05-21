/**
 * Configuration Validation Module
 *
 * This module provides validation utilities for the configuration system.
 * It validates configuration values against their type and constraints,
 * and provides specific error messages for validation failures.
 */
import { ConfigValueType } from '@prisma/client';

import type { ConfigMetadata } from './configService';
/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
    constructor(message: string, public readonly key: string, public readonly validationType: string) {
        super(message);
        this.name = 'ConfigValidationError';
    }
}
/**
 * Configuration validator class
 */
export class ConfigValidator {
    /**
     * Validates a configuration value against its metadata
     *
     * @param value - The value to validate
     * @param metadata - The configuration metadata
     * @returns The validated value, potentially converted to the correct type
     * @throws ConfigValidationError if validation fails
     */
    static validate(value: unknown, metadata: ConfigMetadata): unknown {
        try {
            // Convert value to correct type if needed
            const typedValue = this.convertToType(value, metadata.type);
            // Skip validation if no validation rules defined
            if (!metadata.validation) {
                return typedValue;
            }
            // Validate based on type
            switch (metadata.type) {
                case ConfigValueType.STRING:
                    return this.validateString(typedValue as string, metadata);
                case ConfigValueType.NUMBER:
                    return this.validateNumber(typedValue as number, metadata);
                case ConfigValueType.BOOLEAN:
                    return typedValue; // Boolean values don't need additional validation
                case ConfigValueType.ARRAY:
                    return this.validateArray(typedValue as unknown[], metadata);
                case ConfigValueType.DATE:
                    return this.validateDate(typedValue as Date, metadata);
                case ConfigValueType.OBJECT:
                case ConfigValueType.JSON:
                    return this.validateObject(typedValue as Record<string, unknown>, metadata);
                default:
                    return typedValue;
            }
        }
        catch (error: unknown) {
            if (error instanceof ConfigValidationError) {
                throw error;
            }
            throw new ConfigValidationError(`Validation failed: ${error instanceof Error ? error.message : String(error)}`, metadata.key, 'general');
        }
    }
    /**
     * Converts a value to the specified type
     */
    private static convertToType(value: unknown, type: ConfigValueType): unknown {
        if (value === null) {
            return value;
        }
        try {
            const converters: Record<ConfigValueType, (val: unknown) => unknown> = {
                [ConfigValueType.STRING]: this.convertToString,
                [ConfigValueType.NUMBER]: this.convertToNumber,
                [ConfigValueType.BOOLEAN]: this.convertToBoolean,
                [ConfigValueType.ARRAY]: this.convertToArray,
                [ConfigValueType.OBJECT]: this.convertToObject,
                [ConfigValueType.JSON]: this.convertToObject,
                [ConfigValueType.DATE]: this.convertToDate
            };
            const converter = converters[type];
            return converter(value);
        }
        catch (error: unknown) {
            if (error instanceof ConfigValidationError) {
                throw error;
            }
            throw new ConfigValidationError(`Type conversion failed: ${error instanceof Error ? error.message : String(error)}`, '', 'type');
        }
    }

    /**
     * Converts value to string
     */
    private static convertToString(value: unknown): string {
        return String(value);
    }

    /**
     * Converts value to number
     */
    private static convertToNumber(value: unknown): number {
        if (typeof value === 'string') {
            const num = Number(value);
            if (isNaN(num)) {
                throw new ConfigValidationError(`Value '${value}' is not a valid number`, '', 'type');
            }
            return num;
        }
        if (typeof value !== 'number') {
            throw new ConfigValidationError(`Value is not a number`, '', 'type');
        }
        return value;
    }

    /**
     * Converts value to boolean
     */
    private static convertToBoolean(value: unknown): boolean {
        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            const trueValues = ['true', '1', 'yes'];
            const falseValues = ['false', '0', 'no'];
            if (trueValues.includes(lowerValue)) return true;
            if (falseValues.includes(lowerValue)) return false;
            throw new ConfigValidationError(`Value '${value}' is not a valid boolean`, '', 'type');
        }
        return Boolean(value);
    }

    /**
     * Converts value to array
     */
    private static convertToArray(value: unknown): unknown[] {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value) as unknown[];
            }
            catch (_error: unknown) {
                throw new ConfigValidationError(`Value '${value}' is not a valid array`, '', 'type');
            }
        }
        if (!Array.isArray(value)) {
            throw new ConfigValidationError(`Value is not an array`, '', 'type');
        }
        return value;
    }

    /**
     * Converts value to object
     */
    private static convertToObject(value: unknown): Record<string, unknown> {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value) as Record<string, unknown>;
            }
            catch (_error: unknown) {
                throw new ConfigValidationError(`Value '${value}' is not valid JSON`, '', 'type');
            }
        }
        if (typeof value !== 'object') {
            throw new ConfigValidationError(`Value is not an object`, '', 'type');
        }
        return value as Record<string, unknown>;
    }

    /**
     * Converts value to date
     */
    private static convertToDate(value: unknown): Date {
        if (value instanceof Date) {
            return value;
        }
        if (typeof value === 'string' || typeof value === 'number') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new ConfigValidationError(`Value '${value}' is not a valid date`, '', 'type');
            }
            return date;
        }
        throw new ConfigValidationError(`Value is not a valid date`, '', 'type');
    }
    /**
     * Validates a string value
     */
    private static validateString(value: string, metadata: ConfigMetadata): string {
        const validation = metadata.validation;
        if (!validation) {
            return value;
        }
        // Check minimum length
        if (validation.min !== undefined && value.length < validation.min) {
            throw new ConfigValidationError(`Value must be at least ${validation.min} characters long`, metadata.key, 'minLength');
        }
        // Check maximum length
        if (validation.max !== undefined && value.length > validation.max) {
            throw new ConfigValidationError(`Value must not exceed ${validation.max} characters`, metadata.key, 'maxLength');
        }
        // Check pattern
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            throw new ConfigValidationError(`Value does not match required pattern: ${validation.pattern}`, metadata.key, 'pattern');
        }
        // Check options
        if (metadata.options && metadata.options.length > 0) {
            const allowedValues = metadata.options.map(option => option.value);
            if (!allowedValues.includes(String(value))) {
                throw new ConfigValidationError(`Value must be one of: ${allowedValues.join(', ')}`, metadata.key, 'enum');
            }
        }
        return value;
    }
    /**
     * Validates a number value
     */
    private static validateNumber(value: number, metadata: ConfigMetadata): number {
        const validation = metadata.validation;
        if (!validation) {
            return value;
        }
        // Check minimum value
        if (validation.min !== undefined && value < validation.min) {
            throw new ConfigValidationError(`Value must be at least ${validation.min}`, metadata.key, 'min');
        }
        // Check maximum value
        if (validation.max !== undefined && value > validation.max) {
            throw new ConfigValidationError(`Value must not exceed ${validation.max}`, metadata.key, 'max');
        }
        // Check options
        if (metadata.options && metadata.options.length > 0) {
            const allowedValues = metadata.options.map(option => option.value);
            if (!allowedValues.includes(String(value))) {
                throw new ConfigValidationError(`Value must be one of: ${allowedValues.join(', ')}`, metadata.key, 'enum');
            }
        }
        return value;
    }
    /**
     * Validates an array value
     */
    private static validateArray(value: unknown[], metadata: ConfigMetadata): unknown[] {
        const validation = metadata.validation;
        if (!validation) {
            return value;
        }
        // Check minimum length
        if (validation.min !== undefined && value.length < validation.min) {
            throw new ConfigValidationError(`Array must contain at least ${validation.min} items`, metadata.key, 'minItems');
        }
        // Check maximum length
        if (validation.max !== undefined && value.length > validation.max) {
            throw new ConfigValidationError(`Array must not contain more than ${validation.max} items`, metadata.key, 'maxItems');
        }
        return value;
    }
    /**
     * Validates a date value
     */
    private static validateDate(value: Date, metadata: ConfigMetadata): Date {
        const validation = metadata.validation;
        if (!validation) {
            return value;
        }
        // Check minimum date
        if (validation.min !== undefined) {
            const minDate = new Date(validation.min);
            if (value < minDate) {
                throw new ConfigValidationError(`Date must be on or after ${minDate.toISOString()}`, metadata.key, 'minDate');
            }
        }
        // Check maximum date
        if (validation.max !== undefined) {
            const maxDate = new Date(validation.max);
            if (value > maxDate) {
                throw new ConfigValidationError(`Date must be on or before ${maxDate.toISOString()}`, metadata.key, 'maxDate');
            }
        }
        return value;
    }
    /**
     * Validates an object value
     */
    private static validateObject(value: Record<string, unknown>, _metadata: ConfigMetadata): Record<string, unknown> {
        // No specific validation for objects yet
        return value;
    }
    /**
     * Checks if a configuration value is valid
     *
     * @param value - The value to validate
     * @param metadata - The configuration metadata
     * @returns True if valid, false otherwise
     */
    static isValid(value: unknown, metadata: ConfigMetadata): boolean {
        try {
            this.validate(value, metadata);
            return true;
        }
        catch (_error: unknown) {
            return false;
        }
    }
    /**
     * Gets validation errors for a configuration value
     *
     * @param value - The value to validate
     * @param metadata - The configuration metadata
     * @returns Array of validation error messages
     */
    static getErrors(value: unknown, metadata: ConfigMetadata): string[] {
        try {
            this.validate(value, metadata);
            return [];
        }
        catch (error: unknown) {
            if (error instanceof ConfigValidationError) {
                return [error.message];
            }
            return [`Validation error: ${error instanceof Error ? error.message : String(error)}`];
        }
    }
}
