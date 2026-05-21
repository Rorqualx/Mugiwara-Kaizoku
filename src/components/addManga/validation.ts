/**
 * Validation utilities for the Add Manga flow
 */
import type { MangaMetadata, MangaSearchResult, ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface FieldValidation {
    field: string;
    isValid: boolean;
    error?: string;
    warning?: string;
}
/**
 * Validate manga metadata
 */
export function validateMangaMetadata(metadata: Partial<MangaMetadata>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    // Required fields
    if (!metadata["title"]) {
        errors.push('Title is required');
    }
    // Validate URLs
    const metadataRecord = metadata as Record<string, unknown>;
    const coverUrl = metadataRecord['coverUrl'];
    if (typeof coverUrl === 'string' && !isValidUrl(coverUrl)) {
        warnings.push('Cover URL may be invalid');
    }
    // Validate dates
    const startDate = metadataRecord['startDate'];
    if (startDate !== undefined && startDate !== null && (typeof startDate === 'string' || startDate instanceof Date) && !isValidDate(startDate)) {
        warnings.push('Start date format may be invalid');
    }
    const endDate = metadataRecord['endDate'];
    if (endDate !== undefined && endDate !== null && (typeof endDate === 'string' || endDate instanceof Date) && !isValidDate(endDate)) {
        warnings.push('End date format may be invalid');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
/**
 * Validate search result
 */
export function validateSearchResult(result: Partial<MangaSearchResult>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!result["id"]) {
        errors.push('ID is required');
    }
    if (!result["title"]) {
        errors.push('Title is required');
    }
    const resultRecord = result as Record<string, unknown>;
    if (!result.provider && !resultRecord['source']) {
        errors.push('Provider/Source is required');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
/**
 * Validate field selection
 */
export function validateFieldSelection(field: string, value: unknown): FieldValidation {
    const validation: FieldValidation = {
        field,
        isValid: true
    };
    // Field-specific validation
    switch (field) {
        case 'title': {
            if (!value || typeof value !== 'string' || value.trim().length === 0) {
                validation.isValid = false;
                validation.error = 'Title cannot be empty';
            }
            break;
        }
        case 'year': {
            if (value && (typeof value !== 'number' || value < 1900 || value > new Date().getFullYear() + 1)) {
                validation.isValid = false;
                validation.error = 'Year must be between 1900 and next year';
            }
            break;
        }
        case 'chapters':
        case 'volumes': {
            if (value && (typeof value !== 'number' || value < 0)) {
                validation.isValid = false;
                validation.error = `${field} must be a positive number`;
            }
            break;
        }
        case 'status': {
            const validStatuses = ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'];
            if (value && typeof value === 'string' && !validStatuses.includes(value)) {
                validation.isValid = false;
                validation.error = 'Invalid status value';
            }
            break;
        }
        default:
            // No specific validation for other fields
            break;
    }
    return validation;
}
/**
 * Check if URL is valid
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if date is valid
 */
function isValidDate(date: string | Date): boolean {
    const parsed = date instanceof Date ? date : new Date(date);
    return !isNaN(parsed.getTime());
}
/**
 * Validate extended search result
 */
export function validateExtendedSearchResult(result: Partial<ExtendedMangaSearchResult>): ValidationResult {
    return validateSearchResult(result as Partial<MangaSearchResult>);
}
/**
 * Validate multiple extended search results
 */
export function validateExtendedSearchResults(results: Partial<ExtendedMangaSearchResult>[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    results.forEach((result, index) => {
        const validation = validateExtendedSearchResult(result);
        validation.errors.forEach(error => errors.push(`Result ${index}: ${error}`));
        validation.warnings.forEach(warning => warnings.push(`Result ${index}: ${warning}`));
    });
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
/**
 * Validate component search result
 */
export function validateComponentSearchResult(result: Partial<ExtendedMangaSearchResult>): ValidationResult {
    return validateSearchResult(result as Partial<MangaSearchResult>);
}
/**
 * Validate multiple search results
 */
export function validateSearchResults(results: Partial<MangaSearchResult>[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    results.forEach((result, index) => {
        const validation = validateSearchResult(result);
        validation.errors.forEach(error => errors.push(`Result ${index}: ${error}`));
        validation.warnings.forEach(warning => warnings.push(`Result ${index}: ${warning}`));
    });
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
/**
 * Return type for validation context
 */
export interface ValidationContext {
    name: string;
    errors: string[];
    warnings: string[];
    addError: (error: string) => void;
    addWarning: (warning: string) => void;
    isValid: () => boolean;
}

/**
 * Create validation context
 */
export function createValidationContext(name: string): ValidationContext {
    return {
        name,
        errors: [] as string[],
        warnings: [] as string[],
        addError: function (error: string): void { this.errors.push(error); },
        addWarning: function (warning: string): void { this.warnings.push(warning); },
        isValid: function (): boolean { return this.errors.length === 0; }
    };
}
/**
 * Safe access helper
 */
export function safeAccess<T>(obj: unknown, path: string, defaultValue?: T): T | undefined {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
        if (current === null)
            return defaultValue;
        if (typeof current !== 'object') return defaultValue;
        current = (current as Record<string, unknown>)[key];
    }
    return (current ?? defaultValue) as T | undefined;
}
/**
 * Safe access multiple paths
 */
export function safeAccessMultiple<T>(obj: unknown, paths: string[], defaultValue?: T): T | undefined {
    for (const path of paths) {
        const value = safeAccess<T>(obj, path);
        if (value !== undefined)
            return value;
    }
    return defaultValue;
}
/**
 * Get property with fallback
 */
export function getPropertyWithFallback<T>(obj: unknown, properties: string[], defaultValue?: T): T | undefined {
    return safeAccessMultiple(obj, properties, defaultValue);
}
/**
 * Log validation warning
 */
export function logValidationWarning(context: string, message: string, data?: unknown): void {
    logger.warn(`[Validation] ${context}: ${message}`, data);
}
/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!config["name"]) {
        errors.push('Provider name is required');
    }
    if (config["enabled"] === undefined) {
        warnings.push('Provider enabled status not specified, defaulting to true');
    }
    if (config["priority"] !== null && (typeof config["priority"] !== 'number' || config["priority"] < 0)) {
        errors.push('Provider priority must be a non-negative number');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
export default {
    validateMangaMetadata,
    validateSearchResult,
    validateFieldSelection,
    validateProviderConfig
};
