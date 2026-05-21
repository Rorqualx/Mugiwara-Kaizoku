// import { logger } from '@/utils/logger';
import { ValidationError } from '@/utils/errors';

/**
 * Centralized Type Guard Library
 *
 * This module provides all type guard functions used throughout the application.
 * It consolidates type guards from various locations to eliminate duplication
 * and provide a single source of truth for runtime type checking.
 *
 * @module utils/type-guards
 */

// Re-exports from organized modules
// Using explicit re-exports to avoid conflicts between adapters and domain modules
export * from './api';
export * from './utility';
export * from './user';

// Domain type guards take precedence over adapter type guards
// to maintain consistent domain-driven design
export * from './domain';

// Adapter type guards (excluding conflicts with domain)
export {
  isMetadataSourceInfo,
  isRateLimitConfig,
  isAuthConfig,
  isSelectorMapping,
  isSearchResultSelectors,
  isMangaDetailSelectors,
  isChapterListSelectors,
  isDownloadLinkSelectors,
  isDownloadServiceConfig,
  isNativeDownloadMangaData,
  isNativeDownloadChapterData,
  isINativeDownloadAdapter,
  isExtendedMangaSearchResult,
  isProviderSearchResult,
  isSearchResponseWithErrors,
  isExternalLink,
  isRecentRelease,
  isEnhancedMangaMetadata,
  isFetchRecentReleasesOptions,
  isReleaseScheduleCapabilities,
  isProviderReleaseSchedule,
  isNativeDownloadProvider,
  isNativeDownloadManga,
  isNativeDownloadChapter,
  isNativeDownloadSearchResult,
  isTaskEntity,
  isAppConfig,
  isMetadataDetails,
  isProviderMetadata,
  isNotificationTestResult,
  isCalendarEvent,
  isUnifiedSource,
  isMangaSource,
  isSourceFilter,
  isSourceStats,
  isLibraryState,
  isLibraryActions,
  isMangaState,
  isMangaActions,
  isUIState,
  isUIActions,
  isDownloadQueueState,
  isDownloadQueueActions,
  isIntegrationState,
  isIntegrationActions,
  isRootState,
  isIntegrationStatusData,
  isDatabaseInfo,
  isSystemInfo,
  isDockerInfo,
  isApplicationInfo,
  isSystemStatusResponse,
  isTask,
  isTaskWithProgress,
  isJobState,
  isTaskFilter,
  isTestApiRequest,
  isTestApiResponse,
  isTestUserContext,
  isTestTRPCContext,
  isTestEvent,
  isTestEventResponse,
  isTestEventSettings,
  isTestAniListSettings,
  isTestAniListManga,
  isTestTask,
  isTestSettings,
  isTestManga,
  isJobTransaction,
  isTaskPayload,
  isProviderInfo,
  isDefaultProviderResponse,
  isProviderToggleInput,
  isProviderSettingsUpdateInput,
  isRedirectedInput,
  isProvidersRouter,
  isVolume,
  isMediaGallery,
  isVolumesData,
  isBatchFetchProgress,
  isImportProgress,
  isWizardFormData,
  isMetadataPreviewItem,
  isFieldSelectorOption,
  isProviderOption,
  isLoadingStates,
  isErrorStates,
  isPublicUser
} from './adapters';

// Basic utility type guards remain here for backward compatibility
// ===========================================================================
// Basic Type Guards
// ===========================================================================
/**
 * Check if a value is defined (not undefined)
 */
export function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}
/**
 * Check if a value is not null
 */
export function isNotNull<T>(value: T | null): value is T {
    return value !== null;
}
/**
 * Check if a value is defined and not null
 */
export function isPresent<T>(value: T | undefined | null): value is T {
    return value !== null;
}
/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}
/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.trim().length > 0;
}
/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}
/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}
/**
 * Check if a value is a Date object
 */
export function isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
}
/**
 * Alternative Date check that doesn't rely on instanceof
 * This is useful for objects coming from different contexts/frames
 */
export function isDateLike(value: unknown): value is Date {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return (Object.prototype.toString.call(value) === '[object Date]' &&
        !isNaN(Number(value)));
}
/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}
/**
 * Check if a value is an array of a specific type
 */
export function isArrayOf<T>(value: unknown, itemTypeGuard: (item: unknown) => item is T): value is T[] {
    return isArray(value) && value.every(item => itemTypeGuard(item));
}
/**
 * Check if a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
    return isArrayOf(value, isString);
}
/**
 * Check if a value is a number array
 */
export function isNumberArray(value: unknown): value is number[] {
    return isArrayOf(value, isNumber);
}
/**
 * Check if a value is an object (not null, not an array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Check if a value is a plain object (direct instance of Object)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (isObject(value) &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}
/**
 * Check if a value is a function
 */
export function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}
/**
 * Check if a value is a record (object with string keys)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return isObject(value);
}
/**
 * Check if a value is a record with string keys and values of a specific type
 */
export function isRecordOf<T>(value: unknown, valueTypeGuard: (value: unknown) => value is T): value is Record<string, T> {
    if (!isObject(value)) {
        return false;
    }
    return Object.values(value).every(val => valueTypeGuard(val));
}
/**
 * Check if a value is a record with string keys and string values
 */
export function isStringRecord(value: unknown): value is Record<string, string> {
    return isRecordOf(value, isString);
}
/**
 * Check if a value is a record with string keys and number values
 */
export function isNumberRecord(value: unknown): value is Record<string, number> {
    return isRecordOf(value, isNumber);
}
// ===========================================================================
// Utility Type Guards
// ===========================================================================
/**
 * Check if a value matches a specific enum
 */
export function isEnum<T extends Record<string, string | number>>(value: unknown, enumObj: T): value is T[keyof T] {
    return Object.values(enumObj).includes(value as T[keyof T]);
}
/**
 * Check if a value has a specific property
 */
export function hasProperty<K extends string>(value: unknown, property: K): value is {
    [P in K]: unknown;
} {
    return isObject(value) && property in value;
}
/**
 * Check if a value has a specific property of a certain type
 */
export function hasPropertyOfType<K extends string, T>(value: unknown, property: K, typeGuard: (propValue: unknown) => propValue is T): value is {
    [P in K]: T;
} {
    return (hasProperty(value, property) &&
        typeGuard((value as Record<string, unknown>)[property]));
}
/**
 * Type guard for checking if a value has all required properties
 */
export function hasRequiredProperties<K extends string>(value: unknown, properties: K[]): value is {
    [P in K]: unknown;
} {
    if (!isObject(value)) {
        return false;
    }
    return properties.every(prop => prop in value);
}
/**
 * Type guard for checking if a value is one of a set of allowed values
 */
export function isOneOf<T extends string | number | boolean>(value: unknown, allowedValues: ReadonlyArray<T>): value is T {
    return allowedValues.includes(value as T);
}
/**
 * Type guard for discriminated union types
 */
export function hasDiscriminant<K extends string, V extends string | number | boolean>(value: unknown, discriminantProp: K, discriminantValue: V): value is {
    [P in K]: V;
} {
    return (hasProperty(value, discriminantProp) &&
        (value as Record<string, unknown>)[discriminantProp] === discriminantValue);
}
/**
 * Type guard for checking if a value matches a specific shape
 */
export function matchesShape<T extends Record<string, unknown>>(value: unknown, propertyTypeGuards: {
    [K in keyof T]: (v: unknown) => v is T[K];
}): value is T {
    if (!isObject(value)) {
        return false;
    }

    // Explicitly type the entries to preserve type information through Object.entries()
    // This pattern matches the established codebase convention (see config hooks)
    const entries = Object.entries(propertyTypeGuards) as Array<
        [keyof T, (v: unknown) => v is T[keyof T]]
    >;

    return entries.every(([prop, typeGuard]) => {
        // Cast prop to string since Record<string, unknown> only has string keys
        const propKey = prop as string;
        return hasProperty(value, propKey) &&
            typeGuard((value as Record<string, unknown>)[propKey]);
    });
}
// ===========================================================================
// Error Type Guards
// ===========================================================================
/**
 * Type guard for checking if a value is an Error
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}
/**
 * Type guard for checking if a value is an Axios error
 */
export interface AxiosError {
    isAxiosError: true;
    response?: {
        data?: unknown;
        status?: number;
        headers?: Record<string, string>;
    };
    config?: {
        url?: string;
        method?: string;
    };
    message: string;
}
export function isAxiosError(error: unknown): error is AxiosError {
    return (isObject(error) &&
        hasPropertyOfType(error, 'isAxiosError', isBoolean) &&
        error.isAxiosError === true);
}
/**
 * Type guard for Prisma's known request errors
 * Checks if an error is a PrismaClientKnownRequestError
 */
export function isPrismaError(error: unknown): error is {
    code: string;
    meta?: Record<string, unknown>;
    clientVersion?: string;
} {
    if (!(error instanceof Error))
        return false;
    const prismaError = error as {
        code?: string;
        meta?: Record<string, unknown>;
        clientVersion?: string;
    };
    return ('code' in prismaError &&
        typeof prismaError.code === 'string' &&
        (prismaError.code.startsWith('P') || // Prisma error codes start with P
            ['SQLITE_CONSTRAINT', 'FOREIGN KEY CONSTRAINT FAILED'].includes(prismaError.code)));
}
// ===========================================================================
// Promise and Async Type Guards
// ===========================================================================
/**
 * Type guard for checking if a value is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
    return (isObject(value) &&
        hasPropertyOfType(value, 'then', isFunction) &&
        hasPropertyOfType(value, 'catch', isFunction));
}
// ===========================================================================
// JSON Type Guards
// ===========================================================================
/**
 * Type guard for checking if a string is a valid JSON string
 */
export function isJsonString(value: unknown): value is string {
    if (!isString(value)) {
        return false;
    }
    try {
        JSON.parse(value);
        return true;
    }
    catch (_e: unknown) {// const errorMessage = e instanceof Error ? _e.message : String(_e);
return false;
    }
}
// ===========================================================================
// ID Type Guards
// ===========================================================================
/**
 * Type guard for ID (string or number)
 */
export function isID(value: unknown): value is string | number {
    return isString(value) || isNumber(value);
}
/**
 * Check if an ID is numeric
 */
export function isNumericId(id: string | number): id is number {
    return typeof id === 'number';
}
/**
 * Check if an ID is a string
 */
export function isStringId(id: string | number): id is string {
    return typeof id === 'string';
}
// ===========================================================================
// Re-exports for commonly used type utilities
// ===========================================================================
/**
 * Assert that a code path should never be reached
 * Useful for exhaustive switch/if statements
 */
export function assertNever(value: never): never {
    throw new ValidationError(`Unexpected value: ${value}`);
}
/**
 * Type guard that always returns true but narrows the type
 * Useful for filtering arrays
 */
export function isNonNullable<T>(value: T): value is NonNullable<T> {
    return value !== null;
}
/**
 * Type guard for checking if a value is "truthy" in TypeScript terms
 */
export function isTruthy<T>(value: T | null | undefined | false | 0 | ''): value is T {
    return Boolean(value);
}
/**
 * Type guard for checking if a value is "falsy" in TypeScript terms
 */
export function isFalsy(value: unknown): value is null | undefined | false | 0 | '' {
    return !value;
}
