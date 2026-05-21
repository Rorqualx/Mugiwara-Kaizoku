/**
 * Schema Validation
 *
 * This file contains utilities for validating data against schema definitions.
 * It provides a simple, direct approach to runtime data validation without
 * heavy dependencies.
 */
import { ValidationError as BaseValidationError } from '@/utils/errors';

import * as guards from './type-guards';
/**
 * Validation error details
 */
export interface ValidationError {
    path: string;
    message: string;
    value?: unknown;
}
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}
/**
 * Field validation schema type
 */
export type FieldValidator = (value: unknown, path: string) => ValidationError[];
/**
 * Schema definition - a map of field names to validator functions
 */
export interface ValidationSchema {
    [field: string]: FieldValidator;
}
/**
 * Create a successful validation result
 */
export function validResult(): ValidationResult {
    return { valid: true, errors: [] };
}
/**
 * Create a failed validation result with errors
 */
export function invalidResult(errors: ValidationError[]): ValidationResult {
    return { valid: false, errors };
}
/**
 * Create a validation error
 */
export function validationError(path: string, message: string, value?: unknown): ValidationError {
    return { path, message, value };
}
/**
 * Required field validator
 */
export function required(): FieldValidator {
    return (value, path) => {
        if (!guards.isPresent(value)) {
            return [validationError(path, 'Field is required', value)];
        }
        return [];
    };
}
/**
 * String validator
 */
export function string(options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        if (!guards.isString(value)) {
            errors.push(validationError(path, 'Must be a string', value));
            return errors;
        }
        if (options.minLength !== undefined && value.length < options.minLength) {
            errors.push(validationError(path, `Must be at least ${options.minLength} characters`, value));
        }
        if (options.maxLength !== undefined && value.length > options.maxLength) {
            errors.push(validationError(path, `Must be at most ${options.maxLength} characters`, value));
        }
        if (options.pattern !== undefined && !options.pattern.test(value)) {
            errors.push(validationError(path, `Must match pattern ${options.pattern}`, value));
        }
        return errors;
    };
}
/**
 * Number validator
 */
export function number(options: {
    min?: number;
    max?: number;
    integer?: boolean;
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        if (!guards.isNumber(value)) {
            errors.push(validationError(path, 'Must be a number', value));
            return errors;
        }
        if (options.min !== undefined && value < options.min) {
            errors.push(validationError(path, `Must be at least ${options.min}`, value));
        }
        if (options.max !== undefined && value > options.max) {
            errors.push(validationError(path, `Must be at most ${options.max}`, value));
        }
        if (options.integer === true && !Number.isInteger(value)) {
            errors.push(validationError(path, 'Must be an integer', value));
        }
        return errors;
    };
}
/**
 * Boolean validator
 */
export function boolean(options: {
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        if (!guards.isBoolean(value)) {
            errors.push(validationError(path, 'Must be a boolean', value));
        }
        return errors;
    };
}
/**
 * Date validator
 */
export function date(options: {
    min?: Date;
    max?: Date;
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        // Convert string dates to Date objects
        let dateValue: Date;
        if (guards.isString(value)) {
            dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) {
                errors.push(validationError(path, 'Invalid date format', value));
                return errors;
            }
        }
        else if (guards.isDate(value)) {
            dateValue = value;
        }
        else {
            errors.push(validationError(path, 'Must be a date or date string', value));
            return errors;
        }
        if (options.min !== undefined && dateValue < options.min) {
            errors.push(validationError(path, `Must be after ${options.min.toISOString()}`, value));
        }
        if (options.max !== undefined && dateValue > options.max) {
            errors.push(validationError(path, `Must be before ${options.max.toISOString()}`, value));
        }
        return errors;
    };
}
/**
 * Array validator
 */
export function array(itemValidator?: FieldValidator, options: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        if (!guards.isArray(value)) {
            errors.push(validationError(path, 'Must be an array', value));
            return errors;
        }
        if (options.minLength !== undefined && value.length < options.minLength) {
            errors.push(validationError(path, `Must contain at least ${options.minLength} items`, value));
        }
        if (options.maxLength !== undefined && value.length > options.maxLength) {
            errors.push(validationError(path, `Must contain at most ${options.maxLength} items`, value));
        }
        if (itemValidator) {
            value.forEach((item, index) => {
                const itemPath = `${path}[${index}]`;
                const itemErrors = itemValidator(item, itemPath);
                errors.push(...itemErrors);
            });
        }
        return errors;
    };
}
/**
 * Object validator
 */
export function object(schema: ValidationSchema, options: {
    required?: boolean;
    allowUnknown?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        if (!guards.isObject(value)) {
            errors.push(validationError(path, 'Must be an object', value));
            return errors;
        }
        // Validate each field in the schema
        for (const [field, validator] of Object.entries(schema)) {
            const fieldPath = path ? `${path}.${field}` : field;
            const fieldValue = (value as Record<string, unknown>)[field];
            const fieldErrors = validator(fieldValue, fieldPath);
            errors.push(...fieldErrors);
        }
        // Check for unknown fields if not allowed
        if (options.allowUnknown === false) {
            const unknownFields = Object.keys(value).filter(key => !Object.keys(schema).includes(key));
            if (unknownFields.length > 0) {
                errors.push(validationError(path, `Unknown fields: ${unknownFields.join(', ')}`, unknownFields));
            }
        }
        return errors;
    };
}
/**
 * Enum validator
 */
export function enumValidator<T extends Record<string, string | number>>(enumObj: T, options: {
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        const errors: ValidationError[] = [];
        if (options.required !== false && !guards.isPresent(value)) {
            errors.push(validationError(path, 'Field is required', value));
            return errors;
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return errors;
        }
        if (!guards.isEnum(value, enumObj)) {
            const validValues = Object.values(enumObj).join(', ');
            errors.push(validationError(path, `Must be one of: ${validValues}`, value));
        }
        return errors;
    };
}
/**
 * Union validator (accepts any of the provided validators)
 */
export function union(validators: FieldValidator[], options: {
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        if (options.required !== false && !guards.isPresent(value)) {
            return [validationError(path, 'Field is required', value)];
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return [];
        }
        // If any validator passes, the value is valid
        for (const validator of validators) {
            const errors = validator(value, path);
            if (errors.length === 0) {
                return [];
            }
        }
        // If we get here, all validators failed
        return [validationError(path, 'Value does not match any of the allowed types', value)];
    };
}
/**
 * Custom validator
 */
export function custom(validate: (value: unknown) => boolean | string, options: {
    required?: boolean;
} = {}): FieldValidator {
    return (value, path) => {
        if (options.required !== false && !guards.isPresent(value)) {
            return [validationError(path, 'Field is required', value)];
        }
        // Allow null/undefined if not required
        if (!guards.isPresent(value)) {
            return [];
        }
        const result = validate(value);
        if (result === true || result === '') {
            return [];
        }
        const message = typeof result === 'string'
            ? result
            : 'Failed custom validation';
        return [validationError(path, message, value)];
    };
}
/**
 * Validate an object against a schema
 */
export function validateSchema(data: unknown, schema: ValidationSchema): ValidationResult {
    if (!guards.isObject(data)) {
        return invalidResult([
            validationError('', 'Data must be an object', data)
        ]);
    }
    const errors: ValidationError[] = [];
    for (const [field, validator] of Object.entries(schema)) {
        const fieldErrors = validator(data[field], field);
        errors.push(...fieldErrors);
    }
    return errors.length === 0
        ? validResult()
        : invalidResult(errors);
}
/**
 * Simple validation function that throws an error if validation fails
 */
export function validateOrThrow(data: unknown, schema: ValidationSchema, errorMessage = 'Validation failed'): void {
    const result = validateSchema(data, schema);
    if (!result.valid) {
        const details = result.errors.map(err => `${err.path}: ${err.message}`).join('; ');
        throw new BaseValidationError(`${errorMessage}: ${details}`);
    }
}
