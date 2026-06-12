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

// ===========================================================================
// Basic Type Guards
// ===========================================================================
// Merged from the former src/utils/type-guards.ts shim (2026-06-12). That file
// shadowed this directory in module resolution, so the 50+ importers of
// `@/utils/type-guards` were silently getting the shim instead of this index.
// Where the two copies diverged, the shim's semantics won (its importers were
// the only consumers of the overlapping names): `isPresent` excludes undefined,
// `isNonEmptyString` does NOT trim, `hasProperty` narrows to
// Record<string, unknown>, and `isFunction` narrows to a callable signature.

/**
 * Check if a value is defined (not null and not undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
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
export function isPresent<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}
/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}
/**
 * Check if a value is a non-empty string (whitespace counts as content)
 */
export function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.length > 0;
}
/**
 * Check if a value is a number (excludes NaN)
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
 * Check if a value is null
 */
export function isNull(value: unknown): value is null {
    return value === null;
}
/**
 * Check if a value is undefined
 */
export function isUndefined(value: unknown): value is undefined {
    return value === undefined;
}
/**
 * Check if a value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}
/**
 * Check if a value is a Date object with a valid time
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
 * Check if a value is a function (narrows to a callable signature)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFunction(value: unknown): value is (...args: unknown[]) => any {
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
 * Check if a value has a specific property.
 * Narrows to Record<string, unknown> so any key is indexable after the guard.
 */
export function hasProperty(
    obj: unknown,
    key: string
): obj is Record<string, unknown> {
    return isObject(obj) && key in obj;
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
/**
 * Safe property access with a default value
 */
export function getProperty<T>(
    obj: unknown,
    key: string,
    defaultValue: T
): T {
    if (!isObject(obj)) return defaultValue;
    const value = (obj as Record<string, unknown>)[key];
    return value as T ?? defaultValue;
}
// ===========================================================================
// Safe Casting Helpers
// ===========================================================================
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
 * Check if a value carries a string `message` property
 */
export function hasMessage(value: unknown): value is { message: string } {
    return isObject(value) && 'message' in value && isString((value as Record<string, unknown>)["message"]);
}
/**
 * Check if a value carries a string `stack` property
 */
export function hasStack(value: unknown): value is { stack: string } {
    return isObject(value) && 'stack' in value && isString((value as Record<string, unknown>)["stack"]);
}
/**
 * Extract a human-readable message from an unknown error value
 */
export function getErrorMessage(error: unknown): string {
    if (isError(error)) return error.message;
    if (hasMessage(error)) return error.message;
    if (isString(error)) return error;
    return 'An unknown error occurred';
}
/**
 * Extract a stack trace from an unknown error value, if present
 */
export function getErrorStack(error: unknown): string | undefined {
    if (isError(error)) return error.stack;
    if (hasStack(error)) return error.stack;
    return undefined;
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
// Event Type Guards
// ===========================================================================
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
// ===========================================================================
// React Type Guards
// ===========================================================================
export function isReactNode(value: unknown): boolean {
    return value === null ||
        value === undefined ||
        isString(value) ||
        isNumber(value) ||
        isBoolean(value) ||
        (isObject(value) && '$$typeof' in value);
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
    catch (_e: unknown) {
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
// Assertion Helpers
// ===========================================================================
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
/**
 * Assert that a code path should never be reached
 * Useful for exhaustive switch/if statements
 */
export function assertNever(value: never): never {
    throw new ValidationError(`Unexpected value: ${value}`);
}
// ===========================================================================
// Narrowing Helpers
// ===========================================================================
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
