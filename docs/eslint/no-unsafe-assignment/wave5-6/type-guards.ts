/**
 * Type Guard Templates for Wave 5-6
 *
 * This file contains reusable type guard patterns and utilities
 * for fixing no-unsafe-assignment violations related to dynamic
 * property access and third-party integrations.
 *
 * @module type-guards
 * @category ESLint Remediation
 */

/* ============================================================================
 * METADATA TYPE GUARDS
 * ========================================================================== */

/**
 * Known metadata fields that can be selected from providers
 */
export type MetadataField =
    | 'title'
    | 'alternativeTitles'
    | 'description'
    | 'synopsis'
    | 'summary'
    | 'genres'
    | 'tags'
    | 'authors'
    | 'artists'
    | 'publisher'
    | 'status'
    | 'coverImage'
    | 'bannerImage'
    | 'startDate'
    | 'endDate'
    | 'volumes'
    | 'chapters'
    | 'averageScore'
    | 'popularity'
    | 'malId'
    | 'anilistId'
    | 'externalLinks';

/**
 * Map of metadata fields to their expected types
 */
export type MetadataFieldTypeMap = {
    title: string;
    alternativeTitles: string[];
    description: string;
    synopsis: string;
    summary: string;
    genres: string[];
    tags: string[];
    authors: string[];
    artists: string[];
    publisher: string;
    status: 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'UPCOMING' | 'NOT_YET_PUBLISHED' | 'UNKNOWN';
    coverImage: string;
    bannerImage: string;
    startDate: Date | string | null;
    endDate: Date | string | null;
    volumes: number | null;
    chapters: number | null;
    averageScore: number | null;
    popularity: number | null;
    malId: string | null;
    anilistId: string | null;
    externalLinks: Array<{ url: string; type: string }>;
};

/**
 * Type guard to check if a string is a valid metadata field
 */
export function isMetadataField(key: string): key is MetadataField {
    const validFields: MetadataField[] = [
        'title', 'alternativeTitles', 'description', 'synopsis', 'summary',
        'genres', 'tags', 'authors', 'artists', 'publisher', 'status',
        'coverImage', 'bannerImage', 'startDate', 'endDate', 'volumes',
        'chapters', 'averageScore', 'popularity', 'malId', 'anilistId',
        'externalLinks'
    ];
    return validFields.includes(key as MetadataField);
}

/**
 * Safe accessor for metadata fields with type narrowing
 */
export function getMetadataField<K extends MetadataField>(
    metadata: Record<string, unknown>,
    field: K
): MetadataFieldTypeMap[K] | undefined {
    const value = metadata[field];

    // Runtime type validation based on field
    switch (field) {
        case 'title':
        case 'description':
        case 'synopsis':
        case 'summary':
        case 'publisher':
        case 'coverImage':
        case 'bannerImage':
        case 'malId':
        case 'anilistId':
            return typeof value === 'string' ? (value as MetadataFieldTypeMap[K]) : undefined;

        case 'alternativeTitles':
        case 'genres':
        case 'tags':
        case 'authors':
        case 'artists':
            return Array.isArray(value) && value.every(item => typeof item === 'string')
                ? (value as MetadataFieldTypeMap[K])
                : undefined;

        case 'status':
            const validStatuses = ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'UPCOMING', 'NOT_YET_PUBLISHED', 'UNKNOWN'];
            return typeof value === 'string' && validStatuses.includes(value)
                ? (value as MetadataFieldTypeMap[K])
                : undefined;

        case 'volumes':
        case 'chapters':
        case 'averageScore':
        case 'popularity':
            return (typeof value === 'number' || value === null)
                ? (value as MetadataFieldTypeMap[K])
                : undefined;

        case 'startDate':
        case 'endDate':
            return (typeof value === 'string' || value instanceof Date || value === null)
                ? (value as MetadataFieldTypeMap[K])
                : undefined;

        case 'externalLinks':
            return Array.isArray(value) &&
                   value.every(item =>
                       typeof item === 'object' &&
                       item !== null &&
                       'url' in item &&
                       'type' in item
                   )
                ? (value as MetadataFieldTypeMap[K])
                : undefined;

        default:
            return undefined;
    }
}

/* ============================================================================
 * PROVIDER TYPE GUARDS
 * ========================================================================== */

/**
 * Known metadata providers
 */
export type ProviderKey = 'anilist' | 'comicvine' | 'fandom' | 'wikipedia' | 'suwayomi' | 'kapowarr' | 'none';

/**
 * Type guard for provider keys
 */
export function isProviderKey(key: string): key is ProviderKey {
    const validProviders: ProviderKey[] = ['anilist', 'comicvine', 'fandom', 'wikipedia', 'suwayomi', 'kapowarr', 'none'];
    return validProviders.includes(key as ProviderKey);
}

/**
 * Provider metadata structure
 */
export interface ProviderMetadata {
    [provider: string]: unknown;
}

/**
 * Safe accessor for provider data
 */
export function getProviderData(
    providerMetadata: ProviderMetadata,
    provider: string
): unknown {
    if (!isProviderKey(provider)) {
        throw new Error(`Invalid provider key: ${provider}`);
    }
    return providerMetadata[provider];
}

/* ============================================================================
 * HTTP RESPONSE TYPE GUARDS
 * ========================================================================== */

/**
 * Generic HTTP response structure
 */
export interface HttpResponse<T = unknown> {
    status: number;
    statusText: string;
    data: T;
    headers: Record<string, string>;
    time?: number;
    error?: string;
}

/**
 * Type guard for HTTP response
 */
export function isHttpResponse(value: unknown): value is HttpResponse {
    return (
        typeof value === 'object' &&
        value !== null &&
        'status' in value &&
        typeof (value as Record<string, unknown>).status === 'number'
    );
}

/**
 * Safe accessor for response properties
 */
export function getResponseProperty<K extends keyof HttpResponse>(
    response: unknown,
    key: K
): HttpResponse[K] | undefined {
    if (!isHttpResponse(response)) {
        return undefined;
    }
    return response[key];
}

/* ============================================================================
 * ERROR TYPE GUARDS
 * ========================================================================== */

/**
 * Node.js error with code
 */
export interface NodeError extends Error {
    code?: string;
}

/**
 * HTTP error with status codes
 */
export interface HttpError extends Error {
    status?: number;
    statusCode?: number;
    response?: {
        status?: number;
        statusCode?: number;
        data?: unknown;
    };
}

/**
 * Type guard for Node.js errors
 */
export function isNodeError(error: unknown): error is NodeError {
    return error instanceof Error && 'code' in error;
}

/**
 * Type guard for HTTP errors
 */
export function isHttpError(error: unknown): error is HttpError {
    return (
        error instanceof Error &&
        ('status' in error || 'statusCode' in error || 'response' in error)
    );
}

/**
 * Safe accessor for error status code
 */
export function getErrorStatus(error: unknown): number | undefined {
    if (!isHttpError(error)) {
        return undefined;
    }

    return (
        error.status ??
        error.response?.status ??
        error.statusCode ??
        error.response?.statusCode
    );
}

/**
 * Safe accessor for error code
 */
export function getErrorCode(error: unknown): string | undefined {
    if (!isNodeError(error)) {
        return undefined;
    }
    return error.code;
}

/* ============================================================================
 * CONFIG TYPE GUARDS
 * ========================================================================== */

/**
 * Generic config object with known keys
 */
export type ConfigKey = string;

/**
 * Type-safe config updater
 */
export function updateConfig<K extends string>(
    config: Record<K, unknown>,
    key: K,
    value: unknown
): Record<K, unknown> {
    return { ...config, [key]: value };
}

/**
 * Create a type guard for config keys
 */
export function createConfigKeyGuard<K extends string>(
    validKeys: readonly K[]
): (key: string) => key is K {
    return (key: string): key is K => {
        return validKeys.includes(key as K);
    };
}

/* ============================================================================
 * PRISMA MODEL TYPE GUARDS
 * ========================================================================== */

/**
 * All Prisma models in the schema
 * NOTE: This should be generated from schema.prisma
 */
export type PrismaModel =
    | 'manga'
    | 'chapter'
    | 'library'
    | 'user'
    | 'metadata'
    | 'releaseSchedule'
    | 'calendarEvent'
    | 'systemEvent'
    | 'downloadQueue'
    | 'task'
    | 'notification'
    | 'integrationConfig'
    | 'providerConfig'
    | 'downloadClient'
    | 'session'
    | 'account'
    | 'verificationToken'
    | 'apiKey'
    | 'webhook'
    | 'mlPattern'
    | 'mlMetric'
    | 'searchIndex'
    | 'cacheEntry'
    | 'rateLimitEntry';
    // Add all other models from schema.prisma

/**
 * Type guard for Prisma model names
 */
export function isPrismaModel(model: string): model is PrismaModel {
    const validModels: PrismaModel[] = [
        'manga', 'chapter', 'library', 'user', 'metadata',
        'releaseSchedule', 'calendarEvent', 'systemEvent',
        'downloadQueue', 'task', 'notification', 'integrationConfig',
        'providerConfig', 'downloadClient', 'session', 'account',
        'verificationToken', 'apiKey', 'webhook', 'mlPattern',
        'mlMetric', 'searchIndex', 'cacheEntry', 'rateLimitEntry'
    ];
    return validModels.includes(model as PrismaModel);
}

/**
 * Validate and normalize Prisma model name
 */
export function validatePrismaModel(model: string): PrismaModel {
    if (!isPrismaModel(model)) {
        throw new Error(`Invalid Prisma model: ${model}. Must be one of: ${getPrismaModels().join(', ')}`);
    }
    return model;
}

/**
 * Get list of all valid Prisma models
 */
export function getPrismaModels(): readonly PrismaModel[] {
    return [
        'manga', 'chapter', 'library', 'user', 'metadata',
        'releaseSchedule', 'calendarEvent', 'systemEvent',
        'downloadQueue', 'task', 'notification', 'integrationConfig',
        'providerConfig', 'downloadClient', 'session', 'account',
        'verificationToken', 'apiKey', 'webhook', 'mlPattern',
        'mlMetric', 'searchIndex', 'cacheEntry', 'rateLimitEntry'
    ] as const;
}

/* ============================================================================
 * RECORD TYPE UTILITIES
 * ========================================================================== */

/**
 * Type guard for Record<string, unknown>
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for Record with specific value type
 */
export function isRecordOf<T>(
    value: unknown,
    valueGuard: (v: unknown) => v is T
): value is Record<string, T> {
    if (!isRecord(value)) {
        return false;
    }
    return Object.values(value).every(valueGuard);
}

/**
 * Safe property accessor for unknown records
 */
export function getProperty<K extends string>(
    obj: Record<string, unknown>,
    key: K
): unknown {
    return obj[key];
}

/**
 * Safe property accessor with type guard
 */
export function getTypedProperty<K extends string, T>(
    obj: Record<string, unknown>,
    key: K,
    typeGuard: (value: unknown) => value is T
): T | undefined {
    const value = obj[key];
    return typeGuard(value) ? value : undefined;
}

/* ============================================================================
 * VALIDATION UTILITIES
 * ========================================================================== */

/**
 * Validate and extract property with default
 */
export function getWithDefault<T>(
    obj: Record<string, unknown>,
    key: string,
    defaultValue: T,
    validator: (value: unknown) => value is T
): T {
    const value = obj[key];
    return validator(value) ? value : defaultValue;
}

/**
 * Require property to exist and match type
 */
export function requireProperty<T>(
    obj: Record<string, unknown>,
    key: string,
    validator: (value: unknown) => value is T
): T {
    const value = obj[key];
    if (!validator(value)) {
        throw new Error(`Required property '${key}' is missing or has wrong type`);
    }
    return value;
}

/* ============================================================================
 * USAGE EXAMPLES
 * ========================================================================== */

/**
 * Example: Safe metadata field access
 *
 * // Before (unsafe)
 * const title = metadata[fieldName];  // any
 *
 * // After (safe)
 * const field: MetadataField = 'title';
 * const title = getMetadataField(metadata, field);  // string | undefined
 */

/**
 * Example: Dynamic field with validation
 *
 * function getField(metadata: Record<string, unknown>, fieldName: string): unknown {
 *     if (!isMetadataField(fieldName)) {
 *         throw new Error(`Invalid metadata field: ${fieldName}`);
 *     }
 *     return getMetadataField(metadata, fieldName);
 * }
 */

/**
 * Example: Error handling
 *
 * try {
 *     await someOperation();
 * } catch (error: unknown) {
 *     const status = getErrorStatus(error);
 *     if (status && status >= 500) {
 *         // Handle server error
 *     }
 * }
 */

/**
 * Example: Prisma dynamic access
 *
 * function batchCreate(model: string, data: unknown[]): Promise<unknown> {
 *     const validModel = validatePrismaModel(model);
 *     const modelClient = prisma[validModel];
 *     return modelClient.createMany({ data });
 * }
 */
