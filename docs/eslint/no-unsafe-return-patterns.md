# @typescript-eslint/no-unsafe-return Pattern Catalog

*Status: Active*
*Author: Analysis System*
*Created: 2025-11-08*
*Last Updated: 2025-11-08*

## Overview

This document catalogs common patterns that trigger `@typescript-eslint/no-unsafe-return` violations across the Mugiwara Kaizoku codebase. Each pattern includes:
- Real-world examples from the codebase
- Root cause analysis
- Type-safe fix templates
- Reusable utility functions
- Estimated violation count

**Total Estimated Violations: 250-350**

---

## Pattern Analysis Summary

| Pattern | Count | Severity | Fix Complexity |
|---------|-------|----------|----------------|
| 1. Direct "as any" Casts | ~60 | High | Medium |
| 2. Generic "as T" Casts | ~98 | High | Medium |
| 3. JSON.parse with Casts | ~28 | High | Low |
| 4. Double "as unknown as T" Casts | ~58 | High | Medium |
| 5. Property Access on unknown | ~80-120 | Medium | Low |
| 6. Error Property Access | ~30 | Medium | Low |
| 7. Optional Chain Returns | ~20 | Low | Low |
| 8. Array Element Access | ~15 | Medium | Medium |

---

## Pattern 1: Direct "as any" Casts

### Description
Functions that return values cast to `any`, bypassing all type checking.

### Examples from Codebase

**Example 1.1: Property Access (src/utils/safe-render.ts)**
```typescript
// ❌ UNSAFE
export function safeRender(value: unknown): React.ReactNode {
    if (typeof value === 'object' && value !== null) {
        if ('message' in value && typeof (value as any).message === 'string') {
            return (value as any).message;  // ⚠️ no-unsafe-return
        }
    }
}
```

**Example 1.2: Factory Pattern (src/server/adapters/AdapterFactory.ts)**
```typescript
// ❌ UNSAFE
public create<T>(type: AdapterType): any {
    const entry = this.registry.get(type);
    if (entry && entry.singleton && entry.instance) {
        return entry.instance as any;  // ⚠️ no-unsafe-return
    }
    return instance as any;  // ⚠️ no-unsafe-return
}
```

**Example 1.3: Metadata Cache (src/utils/metadata-cache.ts)**
```typescript
// ❌ UNSAFE
get(provider: string, id: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return (entry as any).data;  // ⚠️ no-unsafe-return
}
```

### Root Cause
- Type information lost during object manipulation
- Attempting to return values from weakly-typed external APIs
- Avoiding proper type guards

### Fix Templates

**Fix 1.1: Use Type Guards**
```typescript
// ✅ SAFE
interface HasMessage {
    message: string;
}

function hasMessage(value: unknown): value is HasMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        typeof (value as Record<string, unknown>).message === 'string'
    );
}

export function safeRender(value: unknown): React.ReactNode {
    if (hasMessage(value)) {
        return value.message;  // ✅ Type-safe
    }
    return null;
}
```

**Fix 1.2: Generic Constraints**
```typescript
// ✅ SAFE
interface AdapterInstance {
    configure: (config: unknown) => void;
}

public create<T extends AdapterInstance>(
    type: AdapterType
): T | null {
    const entry = this.registry.get(type);
    if (entry && entry.singleton && entry.instance) {
        // Add runtime type validation
        if (this.isValidAdapter<T>(entry.instance)) {
            return entry.instance;  // ✅ Type-safe
        }
    }
    return null;
}

private isValidAdapter<T>(instance: unknown): instance is T {
    return (
        typeof instance === 'object' &&
        instance !== null &&
        'configure' in instance
    );
}
```

**Fix 1.3: Explicit Return Types**
```typescript
// ✅ SAFE
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    size: number;
}

get<T = unknown>(provider: string, id: string): T | null {
    const key = this.getCacheKey(provider, id);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    return entry.data;  // ✅ Type-safe with generic
}
```

### Reusable Utilities

```typescript
/**
 * Safe property accessor with type validation
 */
export function getTypedProperty<T>(
    obj: unknown,
    key: string,
    validator: (value: unknown) => value is T
): T | undefined {
    if (typeof obj !== 'object' || obj === null) {
        return undefined;
    }
    
    const value = (obj as Record<string, unknown>)[key];
    return validator(value) ? value : undefined;
}

/**
 * Common type validators
 */
export const isString = (value: unknown): value is string => 
    typeof value === 'string';

export const isNumber = (value: unknown): value is number => 
    typeof value === 'number';

/**
 * Usage Example
 */
const message = getTypedProperty(errorObj, 'message', isString);
if (message) {
    return message;  // ✅ Type-safe
}
```

### Estimated Count
**~60 violations** across the codebase

---

## Pattern 2: Generic "as T" Casts

### Description
Functions that cast values to generic type parameters without validation.

### Examples from Codebase

**Example 2.1: Config Service (src/hooks/useConfigService.ts)**
```typescript
// ❌ UNSAFE
const getConfig = async <T,>(
    key: string,
    defaultValue?: T
): Promise<T> => {
    const result = await utils.client.settings.get.query({
        key,
        defaultValue: defaultValue as unknown
    });

    if (result && 'status' in result && result.status === 'success') {
        return result.data as T;  // ⚠️ no-unsafe-return
    }
    
    return defaultValue as T;  // ⚠️ no-unsafe-return
};
```

**Example 2.2: Type Guards (src/utils/type-guards.ts)**
```typescript
// ❌ UNSAFE
export function getProperty<T>(
    obj: unknown,
    key: string,
    defaultValue: T
): T {
    if (!isObject(obj)) return defaultValue;
    const value = obj[key];
    return value as T ?? defaultValue;  // ⚠️ no-unsafe-return
}

export function asArray<T>(value: unknown, defaultValue: T[] = []): T[] {
    return isArray(value) ? value as T[] : defaultValue;  // ⚠️ no-unsafe-return
}
```

**Example 2.3: Task Operations (src/hooks/useTaskOperations.ts)**
```typescript
// ❌ UNSAFE
const getTasks = async (filter?: TaskFilter): Promise<AsyncResult<TaskUnion[], Error>> => {
    return handleOperation(async () => {
        const result = await tasksClient.getAll.query(filter ?? {});
        return result as unknown as TaskUnion[];  // ⚠️ no-unsafe-return
    });
};
```

### Root Cause
- Generic type parameters provide no runtime type information
- Assuming external API responses match expected types
- Missing Zod schema validation

### Fix Templates

**Fix 2.1: Add Zod Schema Validation**
```typescript
// ✅ SAFE
import { z } from 'zod';

// Define schema for config response
const ConfigResponseSchema = z.object({
    status: z.literal('success'),
    data: z.unknown()
});

const getConfig = async <T,>(
    key: string,
    defaultValue: T,
    validator: (value: unknown) => value is T
): Promise<T> => {
    const result = await utils.client.settings.get.query({
        key,
        defaultValue: defaultValue as unknown
    });

    // Validate response structure
    const parseResult = ConfigResponseSchema.safeParse(result);
    
    if (parseResult.success && validator(parseResult.data.data)) {
        return parseResult.data.data;  // ✅ Type-safe
    }
    
    return defaultValue;
};

// Usage
const timeout = await getConfig(
    'api.timeout',
    5000,
    (v): v is number => typeof v === 'number'
);
```

**Fix 2.2: Type Guard Parameter**
```typescript
// ✅ SAFE
export function getProperty<T>(
    obj: unknown,
    key: string,
    defaultValue: T,
    validator: (value: unknown) => value is T
): T {
    if (!isObject(obj)) return defaultValue;
    
    const value = obj[key];
    
    if (validator(value)) {
        return value;  // ✅ Type-safe
    }
    
    return defaultValue;
}

// Usage
const count = getProperty(
    data,
    'count',
    0,
    (v): v is number => typeof v === 'number'
);
```

**Fix 2.3: Runtime Validation for API Responses**
```typescript
// ✅ SAFE
import { z } from 'zod';

const TaskUnionSchema = z.union([
    z.object({ type: z.literal('CHECK_CHAPTERS'), /* ... */ }),
    z.object({ type: z.literal('DOWNLOAD'), /* ... */ }),
    // ... other task types
]);

const TaskUnionArraySchema = z.array(TaskUnionSchema);

type TaskUnion = z.infer<typeof TaskUnionSchema>;

const getTasks = async (
    filter?: TaskFilter
): Promise<AsyncResult<TaskUnion[], Error>> => {
    return handleOperation(async () => {
        const result = await tasksClient.getAll.query(filter ?? {});
        
        // Validate with Zod
        const parseResult = TaskUnionArraySchema.safeParse(result);
        
        if (!parseResult.success) {
            throw new Error(`Invalid task data: ${parseResult.error.message}`);
        }
        
        return parseResult.data;  // ✅ Type-safe
    });
};
```

### Reusable Utilities

```typescript
/**
 * Generic property accessor with validation
 */
export function safeGetProperty<T>(
    obj: unknown,
    key: string,
    defaultValue: T,
    validator: (value: unknown) => value is T
): T {
    if (typeof obj !== 'object' || obj === null) {
        return defaultValue;
    }
    
    const value = (obj as Record<string, unknown>)[key];
    return validator(value) ? value : defaultValue;
}

/**
 * Type-safe array cast with validation
 */
export function toTypedArray<T>(
    value: unknown,
    elementValidator: (item: unknown) => item is T
): T[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    
    // Validate all elements
    for (const item of value) {
        if (!elementValidator(item)) {
            return null;
        }
    }
    
    return value;  // ✅ Type-safe after validation
}

/**
 * Zod-based generic validator
 */
export function validateWithSchema<T>(
    value: unknown,
    schema: z.ZodSchema<T>
): T | null {
    const result = schema.safeParse(value);
    return result.success ? result.data : null;
}
```

### Estimated Count
**~98 violations** across the codebase

---

## Pattern 3: JSON.parse with Type Casts

### Description
Parsing JSON strings and immediately casting to a type without validation.

### Examples from Codebase

**Example 3.1: Theme Config (src/client/services/themeConfigService.ts)**
```typescript
// ❌ UNSAFE
async loadConfig(): Promise<ThemeConfig> {
    const configData = await this.storage.get('themeConfig');
    if (configData) {
        return JSON.parse(configData) as ThemeConfig;  // ⚠️ no-unsafe-return
    }
    return this.defaultConfig;
}
```

**Example 3.2: Local Storage Hook (src/hooks/common/useLocalStorage.ts)**
```typescript
// ❌ UNSAFE
const storedValue = useMemo(() => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) as T : initialValue;  // ⚠️ no-unsafe-return
    } catch (error) {
        return initialValue;
    }
}, [key, initialValue]);
```

**Example 3.3: PostgreSQL Notifications (src/server/realtime/PostgresNotificationBridge.ts)**
```typescript
// ❌ UNSAFE
private handleNotification(notification: Notification): void {
    try {
        const payload = JSON.parse(notification.payload) as NotificationPayload;  // ⚠️ no-unsafe-return
        this.processPayload(payload);
    } catch (error) {
        this.logger.error('Failed to parse notification', error);
    }
}
```

### Root Cause
- No validation that parsed JSON matches expected structure
- Trusting external data sources
- Missing Zod schema validation

### Fix Templates

**Fix 3.1: Zod Schema Validation**
```typescript
// ✅ SAFE
import { z } from 'zod';

const ThemeConfigSchema = z.object({
    primaryColor: z.string(),
    fontSize: z.number(),
    darkMode: z.boolean(),
    // ... other fields
});

type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

async loadConfig(): Promise<ThemeConfig> {
    const configData = await this.storage.get('themeConfig');
    
    if (!configData) {
        return this.defaultConfig;
    }
    
    try {
        const parsed: unknown = JSON.parse(configData);
        const result = ThemeConfigSchema.safeParse(parsed);
        
        if (result.success) {
            return result.data;  // ✅ Type-safe
        }
        
        this.logger.warn('Invalid theme config, using defaults', result.error);
        return this.defaultConfig;
    } catch (error) {
        this.logger.error('Failed to parse theme config', error);
        return this.defaultConfig;
    }
}
```

**Fix 3.2: Generic JSON Parser with Validation**
```typescript
// ✅ SAFE
function parseJSON<T>(
    jsonString: string,
    validator: (value: unknown) => value is T,
    fallback: T
): T {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        return validator(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

// Usage with type guard
interface UserPrefs {
    theme: string;
    notifications: boolean;
}

function isUserPrefs(value: unknown): value is UserPrefs {
    return (
        typeof value === 'object' &&
        value !== null &&
        'theme' in value &&
        'notifications' in value &&
        typeof (value as Record<string, unknown>).theme === 'string' &&
        typeof (value as Record<string, unknown>).notifications === 'boolean'
    );
}

const prefs = parseJSON(stored, isUserPrefs, defaultPrefs);  // ✅ Type-safe
```

**Fix 3.3: Zod-based JSON Parser**
```typescript
// ✅ SAFE
import { z } from 'zod';

const NotificationPayloadSchema = z.object({
    event: z.string(),
    data: z.record(z.unknown()),
    timestamp: z.number()
});

type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

private handleNotification(notification: Notification): void {
    try {
        const parsed: unknown = JSON.parse(notification.payload);
        const result = NotificationPayloadSchema.safeParse(parsed);
        
        if (!result.success) {
            this.logger.error('Invalid notification payload', result.error);
            return;
        }
        
        this.processPayload(result.data);  // ✅ Type-safe
    } catch (error) {
        this.logger.error('Failed to parse notification', error);
    }
}
```

### Reusable Utilities

```typescript
/**
 * Type-safe JSON parser with Zod schema
 */
export function parseJSONWithSchema<T>(
    jsonString: string,
    schema: z.ZodSchema<T>
): AsyncResult<T, Error> {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        const result = schema.safeParse(parsed);
        
        if (result.success) {
            return createSuccessResult(result.data);
        }
        
        return createErrorResult(
            new Error(`Schema validation failed: ${result.error.message}`)
        );
    } catch (error) {
        return createErrorResult(
            error instanceof Error ? error : new Error(String(error))
        );
    }
}

/**
 * Type-safe JSON parser with type guard
 */
export function parseJSONWithGuard<T>(
    jsonString: string,
    guard: (value: unknown) => value is T,
    fallback: T
): T {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        return guard(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Type-safe optional JSON parser
 */
export function tryParseJSON<T>(
    jsonString: string | null | undefined,
    schema: z.ZodSchema<T>
): T | null {
    if (!jsonString) return null;
    
    try {
        const parsed: unknown = JSON.parse(jsonString);
        const result = schema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}
```

### Estimated Count
**~28 violations** across the codebase

---

## Pattern 4: Double "as unknown as T" Casts

### Description
Using double type assertions (`as unknown as T`) to force type conversion, bypassing all type safety.

### Examples from Codebase

**Example 4.1: BaseHttpClient Error Handling (src/server/base/BaseHttpClient.ts)**
```typescript
// ❌ UNSAFE
protected transformError(error: unknown, context: ErrorContext): TError {
    if (error instanceof Error && this.isErrorType(error)) {
        return error as TError;
    }
    
    const apiError = new ApiError(`[${context.serviceName}] ${context.operation}`);
    return apiError as unknown as TError;  // ⚠️ no-unsafe-return
}

protected async requestAsync<T = unknown>(
    options: RequestOptions
): Promise<AsyncResult<T, TError>> {
    if (this.disposed) {
        return createErrorResult<T, TError>(
            new Error('Client disposed') as unknown as TError  // ⚠️ no-unsafe-return
        );
    }
    
    if (!isSuccess(response)) {
        return createErrorResult<T, TError>(
            response.error as unknown as TError  // ⚠️ no-unsafe-return
        );
    }
    
    return createSuccessResult<T, TError>(responseData as T);  // ⚠️ no-unsafe-return
}
```

**Example 4.2: AsyncResult Utilities (src/utils/async-result.ts)**
```typescript
// ❌ UNSAFE
export function withContext<T, E extends Error>(
    result: AsyncResult<T, Error>,
    context: Record<string, unknown>
): AsyncResult<T, ContextualError> {
    if (isSuccess(result)) {
        return result as unknown as AsyncResult<T, ContextualError>;  // ⚠️ no-unsafe-return
    }
    
    return createErrorResult<T, ContextualError>(
        new Error(message) as unknown as E  // ⚠️ no-unsafe-return
    );
}
```

**Example 4.3: Task Operations (src/hooks/useTaskOperations.ts)**
```typescript
// ❌ UNSAFE
const getTaskById = async (taskId: number): Promise<AsyncResult<TaskUnion, Error>> => {
    return handleOperation(async () => {
        const result = await tasksClient.getById.query({ id: taskId });
        return result as unknown as TaskUnion;  // ⚠️ no-unsafe-return
    });
};
```

### Root Cause
- Forcing incompatible types to match
- Working around generic type constraints
- Missing proper error type hierarchies

### Fix Templates

**Fix 4.1: Proper Error Type Hierarchy**
```typescript
// ✅ SAFE
// Define error type hierarchy
class BaseApiError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = 'BaseApiError';
    }
}

class ApiError extends BaseApiError {
    constructor(
        message: string,
        public readonly context?: ErrorContext
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Use proper type constraints
class BaseHttpClient<TError extends BaseApiError> {
    protected transformError(
        error: unknown,
        context: ErrorContext
    ): TError {
        // Check if already correct type
        if (this.isErrorType(error)) {
            return error;  // ✅ Type-safe
        }
        
        // Create proper error instance
        const apiError = new ApiError(
            `[${context.serviceName}] ${context.operation}`,
            context
        );
        
        // This is safe because TError extends BaseApiError
        // and ApiError extends BaseApiError
        return apiError as TError;  // ✅ Constrained cast
    }
    
    protected isErrorType(error: unknown): error is TError {
        return error instanceof BaseApiError;
    }
}
```

**Fix 4.2: Generic Constraints with Validation**
```typescript
// ✅ SAFE
export function withContext<T, E extends Error>(
    result: AsyncResult<T, Error>,
    context: Record<string, unknown>,
    errorFactory: (error: Error, context: Record<string, unknown>) => E
): AsyncResult<T, E> {
    if (isSuccess(result)) {
        // Success results don't contain error, so this is safe
        return createSuccessResult<T, E>(result.value);
    }
    
    // Create new error with context using factory
    const contextualError = errorFactory(result.error, context);
    return createErrorResult<T, E>(contextualError);  // ✅ Type-safe
}

// Usage
const resultWithContext = withContext(
    originalResult,
    { userId: 123 },
    (error, ctx) => new ContextualError(error.message, ctx)
);
```

**Fix 4.3: Runtime Type Validation**
```typescript
// ✅ SAFE
import { z } from 'zod';

const TaskUnionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('CHECK_CHAPTERS'), mangaId: z.number() }),
    z.object({ type: z.literal('DOWNLOAD'), chapterId: z.number() }),
    // ... other task types
]);

type TaskUnion = z.infer<typeof TaskUnionSchema>;

const getTaskById = async (
    taskId: number
): Promise<AsyncResult<TaskUnion, Error>> => {
    return handleOperation(async () => {
        const result = await tasksClient.getById.query({ id: taskId });
        
        // Validate with Zod
        const parseResult = TaskUnionSchema.safeParse(result);
        
        if (!parseResult.success) {
            throw new Error(
                `Invalid task data: ${parseResult.error.message}`
            );
        }
        
        return parseResult.data;  // ✅ Type-safe
    });
};
```

### Reusable Utilities

```typescript
/**
 * Type-safe error wrapper with proper hierarchy
 */
export class ContextualError extends Error {
    constructor(
        message: string,
        public readonly context: Record<string, unknown>,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'ContextualError';
    }
}

export function wrapError(
    error: unknown,
    context: Record<string, unknown>
): ContextualError {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;
    return new ContextualError(message, context, cause);
}

/**
 * Type-safe AsyncResult transformer
 */
export function transformResult<T, E1 extends Error, E2 extends Error>(
    result: AsyncResult<T, E1>,
    errorTransform: (error: E1) => E2
): AsyncResult<T, E2> {
    if (isSuccess(result)) {
        return createSuccessResult<T, E2>(result.value);
    }
    return createErrorResult<T, E2>(errorTransform(result.error));
}

/**
 * Discriminated union validator
 */
export function validateDiscriminatedUnion<T>(
    value: unknown,
    discriminator: string,
    validators: Map<string, (v: unknown) => v is T>
): value is T {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    
    const discriminatorValue = (value as Record<string, unknown>)[discriminator];
    
    if (typeof discriminatorValue !== 'string') {
        return false;
    }
    
    const validator = validators.get(discriminatorValue);
    return validator ? validator(value) : false;
}
```

### Estimated Count
**~58 violations** across the codebase

---

## Pattern 5: Property Access on Unknown Objects

### Description
Accessing object properties using bracket notation or dot notation on values of type `unknown` or `any`.

### Examples from Codebase

**Example 5.1: Property Guards (src/utils/property-guards.ts)**
```typescript
// ❌ UNSAFE
export function hasProperty<T, K extends PropertyKey>(
    obj: T,
    prop: K
): obj is T & Record<K, unknown> {
    return obj != null && prop in (obj as any);  // ⚠️ no-unsafe-return
}

export function hasArrayProperty<T, K extends PropertyKey>(
    obj: T,
    prop: K
): obj is T & Record<K, unknown[]> {
    return hasProperty(obj, prop) && Array.isArray((obj as any)[prop]);  // ⚠️ no-unsafe-return
}
```

**Example 5.2: Safe Access Pattern (src/utils/adapters/common-patterns.ts)**
```typescript
// ❌ UNSAFE
export function safeAccess<T = any>(
    obj: unknown,
    path: string,
    defaultValue: T
): T {
    try {
        const parts = path.split('.');
        let current: unknown = obj;
        for (const part of parts) {
            if (current === null || current === undefined) {
                return defaultValue;
            }
            current = (current as Record<string, unknown>)[part];
        }
        return (current === null || current === undefined) 
            ? defaultValue 
            : current as T;  // ⚠️ no-unsafe-return
    } catch {
        return defaultValue;
    }
}
```

**Example 5.3: Error Helpers (src/utils/errors/helpers.ts)**
```typescript
// ❌ UNSAFE
export function getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object') {
        if ('code' in error && typeof (error as any).code === 'string') {
            return (error as any).code;  // ⚠️ no-unsafe-return
        }
        
        if ('statusCode' in error) {
            return String((error as any).statusCode);  // ⚠️ no-unsafe-return
        }
    }
    return undefined;
}
```

### Root Cause
- Need to access properties on `unknown` values
- Dynamic property access patterns
- Working with external API responses

### Fix Templates

**Fix 5.1: Type-safe Property Checks**
```typescript
// ✅ SAFE
export function hasProperty<K extends PropertyKey>(
    obj: unknown,
    prop: K
): obj is Record<K, unknown> {
    return typeof obj === 'object' && obj !== null && prop in obj;
}

export function hasArrayProperty<K extends PropertyKey>(
    obj: unknown,
    prop: K
): obj is Record<K, unknown[]> {
    if (!hasProperty(obj, prop)) {
        return false;
    }
    
    const value = obj[prop];  // ✅ Type-safe after guard
    return Array.isArray(value);
}

// Usage
if (hasArrayProperty(data, 'items')) {
    const items = data.items;  // ✅ Typed as unknown[]
    // Further refine type if needed
}
```

**Fix 5.2: Type-safe Path Access**
```typescript
// ✅ SAFE
export function safeAccess<T>(
    obj: unknown,
    path: string,
    defaultValue: T,
    validator: (value: unknown) => value is T
): T {
    try {
        const parts = path.split('.');
        let current: unknown = obj;
        
        for (const part of parts) {
            if (!hasProperty(current, part)) {
                return defaultValue;
            }
            current = current[part];  // ✅ Type-safe after guard
        }
        
        // Validate final value
        return validator(current) ? current : defaultValue;
    } catch {
        return defaultValue;
    }
}

// Usage
const count = safeAccess(
    data,
    'stats.count',
    0,
    (v): v is number => typeof v === 'number'
);
```

**Fix 5.3: Type-safe Property Getters**
```typescript
// ✅ SAFE
export function getStringProperty(
    obj: unknown,
    key: string
): string | undefined {
    if (!hasProperty(obj, key)) {
        return undefined;
    }
    
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
}

export function getNumberProperty(
    obj: unknown,
    key: string
): number | undefined {
    if (!hasProperty(obj, key)) {
        return undefined;
    }
    
    const value = obj[key];
    return typeof value === 'number' ? value : undefined;
}

export function getErrorCode(error: unknown): string | undefined {
    // Check for code property
    const code = getStringProperty(error, 'code');
    if (code) return code;
    
    // Check for statusCode
    const statusCode = getNumberProperty(error, 'statusCode');
    if (statusCode !== undefined) return String(statusCode);
    
    // Check for status
    const status = getNumberProperty(error, 'status');
    if (status !== undefined) return String(status);
    
    return undefined;
}
```

### Reusable Utilities

```typescript
/**
 * Type-safe property existence check
 */
export function hasProperty<K extends PropertyKey>(
    obj: unknown,
    prop: K
): obj is Record<K, unknown> {
    return typeof obj === 'object' && obj !== null && prop in obj;
}

/**
 * Type-safe typed property getter
 */
export function getTypedProperty<T>(
    obj: unknown,
    key: PropertyKey,
    validator: (value: unknown) => value is T
): T | undefined {
    if (!hasProperty(obj, key)) {
        return undefined;
    }
    
    const value = obj[key];
    return validator(value) ? value : undefined;
}

/**
 * Common property getters
 */
export const PropertyGetters = {
    string: (obj: unknown, key: string) => 
        getTypedProperty(obj, key, (v): v is string => typeof v === 'string'),
    
    number: (obj: unknown, key: string) => 
        getTypedProperty(obj, key, (v): v is number => typeof v === 'number'),
    
    boolean: (obj: unknown, key: string) => 
        getTypedProperty(obj, key, (v): v is boolean => typeof v === 'boolean'),
    
    array: (obj: unknown, key: string) => 
        getTypedProperty(obj, key, (v): v is unknown[] => Array.isArray(v)),
    
    object: (obj: unknown, key: string) => 
        getTypedProperty(
            obj,
            key,
            (v): v is Record<string, unknown> => 
                typeof v === 'object' && v !== null && !Array.isArray(v)
        )
};

/**
 * Type-safe nested property access
 */
export function getNestedProperty<T>(
    obj: unknown,
    path: string[],
    validator: (value: unknown) => value is T
): T | undefined {
    let current: unknown = obj;
    
    for (const key of path) {
        if (!hasProperty(current, key)) {
            return undefined;
        }
        current = current[key];
    }
    
    return validator(current) ? current : undefined;
}
```

### Estimated Count
**~80-120 violations** across the codebase

---

## Pattern 6: Error Property Access

### Description
Accessing properties on error objects without proper type guards, particularly in catch blocks.

### Examples from Codebase

**Example 6.1: Error Message Extraction (src/utils/errors/helpers.ts)**
```typescript
// ❌ UNSAFE
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);  // Could be safer
    }
    
    if (error && typeof error === 'object' && 'error' in error) {
        return getErrorMessage((error as any).error);  // ⚠️ no-unsafe-return
    }
    
    return String(error);
}
```

**Example 6.2: Error Code Extraction (src/utils/errors/helpers.ts)**
```typescript
// ❌ UNSAFE (from earlier example)
export function getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object') {
        if ('code' in error && typeof (error as any).code === 'string') {
            return (error as any).code;  // ⚠️ no-unsafe-return
        }
    }
    return undefined;
}
```

### Root Cause
- Errors can be any type in JavaScript
- Need to extract information from various error shapes
- Missing standardized error interfaces

### Fix Templates

**Fix 6.1: Standardized Error Interfaces**
```typescript
// ✅ SAFE
interface HasMessage {
    message: string;
}

interface HasCode {
    code: string;
}

interface HasError {
    error: unknown;
}

function hasMessage(value: unknown): value is HasMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        typeof (value as Record<string, unknown>).message === 'string'
    );
}

function hasCode(value: unknown): value is HasCode {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof (value as Record<string, unknown>).code === 'string'
    );
}

function hasError(value: unknown): value is HasError {
    return (
        typeof value === 'object' &&
        value !== null &&
        'error' in value
    );
}

export function getErrorMessage(error: unknown): string {
    // Check Error instance first
    if (error instanceof Error) {
        return error.message;
    }
    
    // Check for message property
    if (hasMessage(error)) {
        return error.message;  // ✅ Type-safe
    }
    
    // Check for nested error
    if (hasError(error)) {
        return getErrorMessage(error.error);  // ✅ Type-safe recursion
    }
    
    // Handle string errors
    if (typeof error === 'string') {
        return error;
    }
    
    return 'An unknown error occurred';
}

export function getErrorCode(error: unknown): string | undefined {
    if (hasCode(error)) {
        return error.code;  // ✅ Type-safe
    }
    
    // Check for statusCode
    if (hasProperty(error, 'statusCode')) {
        const statusCode = error.statusCode;
        if (typeof statusCode === 'number' || typeof statusCode === 'string') {
            return String(statusCode);
        }
    }
    
    return undefined;
}
```

**Fix 6.2: Error Type Guards**
```typescript
// ✅ SAFE
interface ApiError {
    message: string;
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;
}

function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        'code' in error &&
        'statusCode' in error &&
        typeof (error as Record<string, unknown>).message === 'string' &&
        typeof (error as Record<string, unknown>).code === 'string' &&
        typeof (error as Record<string, unknown>).statusCode === 'number'
    );
}

export function handleApiError(error: unknown): {
    message: string;
    code: string;
    statusCode: number;
} {
    if (isApiError(error)) {
        return {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
        };  // ✅ Type-safe
    }
    
    // Fallback for non-API errors
    return {
        message: error instanceof Error ? error.message : String(error),
        code: 'UNKNOWN_ERROR',
        statusCode: 500
    };
}
```

### Reusable Utilities

```typescript
/**
 * Standard error interfaces
 */
export interface HasMessage {
    message: string;
}

export interface HasCode {
    code: string;
}

export interface HasStatusCode {
    statusCode: number;
}

export interface HasError {
    error: unknown;
}

/**
 * Error type guards
 */
export function hasMessage(value: unknown): value is HasMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        typeof (value as Record<string, unknown>).message === 'string'
    );
}

export function hasCode(value: unknown): value is HasCode {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof (value as Record<string, unknown>).code === 'string'
    );
}

export function hasStatusCode(value: unknown): value is HasStatusCode {
    return (
        typeof value === 'object' &&
        value !== null &&
        'statusCode' in value &&
        typeof (value as Record<string, unknown>).statusCode === 'number'
    );
}

export function hasError(value: unknown): value is HasError {
    return (
        typeof value === 'object' &&
        value !== null &&
        'error' in value
    );
}

/**
 * Safe error property extractors
 */
export const ErrorUtils = {
    getMessage: (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (hasMessage(error)) return error.message;
        if (typeof error === 'string') return error;
        return 'Unknown error';
    },
    
    getCode: (error: unknown): string | undefined => {
        if (hasCode(error)) return error.code;
        return undefined;
    },
    
    getStatusCode: (error: unknown): number | undefined => {
        if (hasStatusCode(error)) return error.statusCode;
        return undefined;
    },
    
    getStack: (error: unknown): string | undefined => {
        if (error instanceof Error) return error.stack;
        return undefined;
    },
    
    toJSON: (error: unknown) => ({
        message: ErrorUtils.getMessage(error),
        code: ErrorUtils.getCode(error),
        statusCode: ErrorUtils.getStatusCode(error),
        stack: ErrorUtils.getStack(error)
    })
};
```

### Estimated Count
**~30 violations** across the codebase

---

## Pattern 7: Optional Chaining Returns

### Description
Returning values from optional chaining operations without proper null handling.

### Examples from Codebase

**Example 7.1: Provider Queue Length (src/utils/rate-limiter.ts)**
```typescript
// ❌ UNSAFE (Actually safe, but can be improved)
getQueueLength(provider: string): number {
    return this.queues.get(provider)?.length ?? 0;  // This is actually safe
}
```

**Example 7.2: Enrichment Level (src/utils/metadata-cache.ts)**
```typescript
// ❌ UNSAFE
getEnrichmentLevel(data: unknown): EnrichmentLevel | null {
    return (data as any)?._enrichmentLevel ?? null;  // ⚠️ no-unsafe-return
}
```

**Example 7.3: Provider Strength (src/config/providerStrengths.ts)**
```typescript
// ❌ UNSAFE (This is safe but can be more explicit)
export function getProviderStrength(
    providerId: MetadataProvider,
    fieldName: string
): number {
    return PROVIDER_STRENGTHS[providerId]?.[fieldName] ?? 0;  // Safe
}
```

### Root Cause
- Optional chaining combined with type casts
- Returning values from potentially undefined sources

### Fix Templates

**Fix 7.1: Explicit Type Guards**
```typescript
// ✅ SAFE
interface HasEnrichmentLevel {
    _enrichmentLevel: EnrichmentLevel;
}

function hasEnrichmentLevel(value: unknown): value is HasEnrichmentLevel {
    return (
        typeof value === 'object' &&
        value !== null &&
        '_enrichmentLevel' in value &&
        isValidEnrichmentLevel((value as Record<string, unknown>)._enrichmentLevel)
    );
}

function isValidEnrichmentLevel(value: unknown): value is EnrichmentLevel {
    return (
        value === 'BASIC' ||
        value === 'STANDARD' ||
        value === 'FULL'
    );
}

getEnrichmentLevel(data: unknown): EnrichmentLevel | null {
    if (hasEnrichmentLevel(data)) {
        return data._enrichmentLevel;  // ✅ Type-safe
    }
    return null;
}
```

**Fix 7.2: Type-safe Optional Access**
```typescript
// ✅ SAFE
type ProviderStrengths = Record<MetadataProvider, Record<string, number>>;

const PROVIDER_STRENGTHS: ProviderStrengths = {
    // ...
};

export function getProviderStrength(
    providerId: MetadataProvider,
    fieldName: string
): number {
    const provider = PROVIDER_STRENGTHS[providerId];
    if (!provider) return 0;
    
    const strength = provider[fieldName];
    return typeof strength === 'number' ? strength : 0;  // ✅ Type-safe
}
```

### Reusable Utilities

```typescript
/**
 * Safe optional property access
 */
export function getOptionalProperty<T>(
    obj: unknown,
    key: PropertyKey,
    validator: (value: unknown) => value is T,
    defaultValue: T
): T {
    if (!hasProperty(obj, key)) {
        return defaultValue;
    }
    
    const value = obj[key];
    return validator(value) ? value : defaultValue;
}

/**
 * Safe nested optional access
 */
export function getNestedOptional<T>(
    obj: unknown,
    path: PropertyKey[],
    validator: (value: unknown) => value is T
): T | undefined {
    let current: unknown = obj;
    
    for (const key of path) {
        if (!hasProperty(current, key)) {
            return undefined;
        }
        current = current[key];
    }
    
    return validator(current) ? current : undefined;
}
```

### Estimated Count
**~20 violations** across the codebase

---

## Pattern 8: Array Element Access

### Description
Accessing array elements and returning them without type validation.

### Examples from Codebase

**Example 8.1: Entity Metadata Utils (src/utils/entityMetadataUtils.ts)**
```typescript
// ❌ UNSAFE
export function findProviderMetadata(
    metadata: EntityMetadata,
    providerId: string
): ProviderMetadata | undefined {
    return metadata.providers.find(
        (p: unknown) => 
            (p as any).id === providerId || 
            (p as any).provider === providerId  // ⚠️ no-unsafe-return
    );
}
```

**Example 8.2: Store Selectors (src/store/useStoreSelectors.ts)**
```typescript
// ❌ UNSAFE
export const getActiveQueueItems = (state: RootState): QueueItem[] => {
    const { queue } = state.queueState;
    return queue.filter(i => i.status === JobStatus.active);  // Could be safer
};
```

### Root Cause
- Array elements typed as `unknown` or `any`
- Missing type guards on array operations
- Filtering/mapping without type refinement

### Fix Templates

**Fix 8.1: Type Guard with Find**
```typescript
// ✅ SAFE
interface ProviderMetadata {
    id: string;
    provider: string;
    // ... other fields
}

function isProviderMetadata(value: unknown): value is ProviderMetadata {
    return (
        typeof value === 'object' &&
        value !== null &&
        ('id' in value || 'provider' in value) &&
        (
            typeof (value as Record<string, unknown>).id === 'string' ||
            typeof (value as Record<string, unknown>).provider === 'string'
        )
    );
}

export function findProviderMetadata(
    metadata: EntityMetadata,
    providerId: string
): ProviderMetadata | undefined {
    // Type guard the array first
    if (!Array.isArray(metadata.providers)) {
        return undefined;
    }
    
    const result = metadata.providers.find(
        (p: unknown): p is ProviderMetadata => {
            if (!isProviderMetadata(p)) return false;
            return p.id === providerId || p.provider === providerId;
        }
    );
    
    return result;  // ✅ Type-safe
}
```

**Fix 8.2: Type-safe Filter**
```typescript
// ✅ SAFE
interface QueueItem {
    id: string;
    status: JobStatus;
    // ... other fields
}

function isQueueItem(value: unknown): value is QueueItem {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        'status' in value &&
        typeof (value as Record<string, unknown>).id === 'string'
    );
}

export const getActiveQueueItems = (state: RootState): QueueItem[] => {
    const { queue } = state.queueState;
    
    if (!Array.isArray(queue)) {
        return [];
    }
    
    return queue.filter((item): item is QueueItem => {
        if (!isQueueItem(item)) return false;
        return item.status === JobStatus.active;
    });  // ✅ Type-safe
};
```

### Reusable Utilities

```typescript
/**
 * Type-safe array filter
 */
export function filterTyped<T>(
    array: unknown[],
    predicate: (value: unknown) => value is T
): T[] {
    return array.filter(predicate);
}

/**
 * Type-safe array map with validation
 */
export function mapTyped<T, R>(
    array: unknown[],
    guard: (value: unknown) => value is T,
    mapper: (value: T) => R
): R[] {
    return array
        .filter(guard)
        .map(mapper);
}

/**
 * Type-safe array find
 */
export function findTyped<T>(
    array: unknown[],
    predicate: (value: unknown, index: number) => value is T
): T | undefined {
    return array.find(predicate);
}

/**
 * Safe array element access
 */
export function safeArrayAccess<T>(
    array: unknown,
    index: number,
    validator: (value: unknown) => value is T
): T | undefined {
    if (!Array.isArray(array)) {
        return undefined;
    }
    
    if (index < 0 || index >= array.length) {
        return undefined;
    }
    
    const element = array[index];
    return validator(element) ? element : undefined;
}
```

### Estimated Count
**~15 violations** across the codebase

---

## Comprehensive Utility Library

### Core Type Guards

```typescript
// src/utils/type-guards/core.ts

/**
 * Primitive type guards
 */
export const isString = (value: unknown): value is string =>
    typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && !Number.isNaN(value);

export const isBoolean = (value: unknown): value is boolean =>
    typeof value === 'boolean';

export const isNull = (value: unknown): value is null =>
    value === null;

export const isUndefined = (value: unknown): value is undefined =>
    value === undefined;

export const isNullish = (value: unknown): value is null | undefined =>
    value === null || value === undefined;

/**
 * Object type guards
 */
export const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = (value: unknown): value is unknown[] =>
    Array.isArray(value);

/**
 * Property existence guards
 */
export function hasProperty<K extends PropertyKey>(
    obj: unknown,
    prop: K
): obj is Record<K, unknown> {
    return typeof obj === 'object' && obj !== null && prop in obj;
}

export function hasProperties<K extends PropertyKey>(
    obj: unknown,
    props: K[]
): obj is Record<K, unknown> {
    if (!isObject(obj)) return false;
    return props.every(prop => prop in obj);
}

/**
 * Typed property getters
 */
export function getTypedProperty<T>(
    obj: unknown,
    key: PropertyKey,
    validator: (value: unknown) => value is T
): T | undefined {
    if (!hasProperty(obj, key)) return undefined;
    const value = obj[key];
    return validator(value) ? value : undefined;
}
```

### JSON Utilities

```typescript
// src/utils/json/safe-parse.ts

import { z } from 'zod';
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';

/**
 * Parse JSON with Zod schema validation
 */
export function parseJSONWithSchema<T>(
    jsonString: string,
    schema: z.ZodSchema<T>
): AsyncResult<T, Error> {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        const result = schema.safeParse(parsed);
        
        if (result.success) {
            return createSuccessResult(result.data);
        }
        
        return createErrorResult(
            new Error(`Schema validation failed: ${result.error.message}`)
        );
    } catch (error) {
        return createErrorResult(
            error instanceof Error ? error : new Error(String(error))
        );
    }
}

/**
 * Parse JSON with type guard
 */
export function parseJSONWithGuard<T>(
    jsonString: string,
    guard: (value: unknown) => value is T
): T | null {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        return guard(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Parse JSON with fallback
 */
export function parseJSONSafe<T>(
    jsonString: string | null | undefined,
    fallback: T,
    guard: (value: unknown) => value is T
): T {
    if (!jsonString) return fallback;
    
    try {
        const parsed: unknown = JSON.parse(jsonString);
        return guard(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}
```

### Property Access Utilities

```typescript
// src/utils/object/safe-access.ts

/**
 * Safe nested property access with validation
 */
export function safeAccess<T>(
    obj: unknown,
    path: string[],
    validator: (value: unknown) => value is T,
    defaultValue: T
): T {
    let current: unknown = obj;
    
    for (const key of path) {
        if (!hasProperty(current, key)) {
            return defaultValue;
        }
        current = current[key];
    }
    
    return validator(current) ? current : defaultValue;
}

/**
 * Safe dot-notation property access
 */
export function getByPath<T>(
    obj: unknown,
    path: string,
    validator: (value: unknown) => value is T,
    defaultValue: T
): T {
    return safeAccess(obj, path.split('.'), validator, defaultValue);
}

/**
 * Common property getters
 */
export const PropertyGetters = {
    string: (obj: unknown, key: string, defaultValue = '') =>
        getTypedProperty(obj, key, isString) ?? defaultValue,
    
    number: (obj: unknown, key: string, defaultValue = 0) =>
        getTypedProperty(obj, key, isNumber) ?? defaultValue,
    
    boolean: (obj: unknown, key: string, defaultValue = false) =>
        getTypedProperty(obj, key, isBoolean) ?? defaultValue,
    
    array: (obj: unknown, key: string) =>
        getTypedProperty(obj, key, isArray) ?? [],
    
    object: (obj: unknown, key: string) =>
        getTypedProperty(obj, key, isObject) ?? {}
};
```

### Error Handling Utilities

```typescript
// src/utils/errors/type-safe-errors.ts

/**
 * Standard error interfaces
 */
export interface HasMessage {
    message: string;
}

export interface HasCode {
    code: string;
}

export interface HasStatusCode {
    statusCode: number;
}

/**
 * Error type guards
 */
export function hasMessage(value: unknown): value is HasMessage {
    return hasProperty(value, 'message') && isString(value.message);
}

export function hasCode(value: unknown): value is HasCode {
    return hasProperty(value, 'code') && isString(value.code);
}

export function hasStatusCode(value: unknown): value is HasStatusCode {
    return hasProperty(value, 'statusCode') && isNumber(value.statusCode);
}

/**
 * Safe error property extractors
 */
export const ErrorExtractors = {
    getMessage: (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (hasMessage(error)) return error.message;
        if (isString(error)) return error;
        return 'Unknown error';
    },
    
    getCode: (error: unknown): string | undefined => {
        if (hasCode(error)) return error.code;
        return undefined;
    },
    
    getStatusCode: (error: unknown): number | undefined => {
        if (hasStatusCode(error)) return error.statusCode;
        return undefined;
    },
    
    getStack: (error: unknown): string | undefined => {
        if (error instanceof Error) return error.stack;
        return undefined;
    }
};
```

---

## Migration Strategy

### Phase 1: Set Up Utilities (Week 1)
1. Create utility files:
   - `src/utils/type-guards/core.ts`
   - `src/utils/json/safe-parse.ts`
   - `src/utils/object/safe-access.ts`
   - `src/utils/errors/type-safe-errors.ts`
2. Write unit tests for all utilities
3. Document usage examples

### Phase 2: Fix High-Priority Patterns (Weeks 2-3)
1. **Pattern 3: JSON.parse** (~28 violations)
   - Search: `grep -r "JSON\.parse.*as" src/`
   - Replace with `parseJSONWithSchema` or `parseJSONWithGuard`
   - Estimated time: 3-4 hours

2. **Pattern 6: Error Property Access** (~30 violations)
   - Search: `grep -r "(error as any)" src/`
   - Replace with `ErrorExtractors` utilities
   - Estimated time: 3-4 hours

3. **Pattern 7: Optional Chaining** (~20 violations)
   - Manual review of optional chaining patterns
   - Add type guards where needed
   - Estimated time: 2-3 hours

### Phase 3: Fix Medium-Priority Patterns (Weeks 3-4)
4. **Pattern 1: Direct "as any"** (~60 violations)
   - Search: `grep -r "return.*as any" src/`
   - Replace with type guards or proper typing
   - Estimated time: 8-10 hours

5. **Pattern 5: Property Access** (~80-120 violations)
   - Search: `grep -r "\(.*as any\)\[" src/`
   - Replace with `PropertyGetters` or type guards
   - Estimated time: 10-12 hours

6. **Pattern 8: Array Access** (~15 violations)
   - Search for array operations
   - Add type guards to filter/map/find
   - Estimated time: 2-3 hours

### Phase 4: Fix Complex Patterns (Weeks 4-5)
7. **Pattern 2: Generic "as T"** (~98 violations)
   - Requires case-by-case analysis
   - Add Zod schemas or type guards
   - Estimated time: 12-15 hours

8. **Pattern 4: Double Casts** (~58 violations)
   - Review error handling patterns
   - Implement proper error hierarchies
   - Estimated time: 8-10 hours

### Phase 5: Verification (Week 6)
1. Run full TypeScript type check
2. Run ESLint with no-unsafe-return enabled
3. Review any remaining violations
4. Document exceptions with `// eslint-disable-next-line` and justifications

---

## Testing Strategy

### Unit Tests for Utilities

```typescript
// tests/utils/type-guards.test.ts

import { describe, it, expect } from 'bun:test';
import {
    isString,
    isNumber,
    hasProperty,
    getTypedProperty
} from '@/utils/type-guards/core';

describe('Type Guards', () => {
    describe('isString', () => {
        it('should return true for strings', () => {
            expect(isString('hello')).toBe(true);
            expect(isString('')).toBe(true);
        });
        
        it('should return false for non-strings', () => {
            expect(isString(123)).toBe(false);
            expect(isString(null)).toBe(false);
            expect(isString(undefined)).toBe(false);
        });
    });
    
    describe('hasProperty', () => {
        it('should detect existing properties', () => {
            const obj = { foo: 'bar' };
            expect(hasProperty(obj, 'foo')).toBe(true);
        });
        
        it('should return false for missing properties', () => {
            const obj = { foo: 'bar' };
            expect(hasProperty(obj, 'baz')).toBe(false);
        });
        
        it('should handle null and undefined', () => {
            expect(hasProperty(null, 'foo')).toBe(false);
            expect(hasProperty(undefined, 'foo')).toBe(false);
        });
    });
    
    describe('getTypedProperty', () => {
        it('should return typed property value', () => {
            const obj = { count: 42 };
            const result = getTypedProperty(obj, 'count', isNumber);
            expect(result).toBe(42);
        });
        
        it('should return undefined for invalid types', () => {
            const obj = { count: 'not a number' };
            const result = getTypedProperty(obj, 'count', isNumber);
            expect(result).toBeUndefined();
        });
    });
});
```

---

## Performance Considerations

### Type Guard Performance
- Type guards add minimal runtime overhead
- Most guards are simple typeof checks (~1-2ms)
- Nested property checks scale linearly with depth
- Consider memoization for repeated validation

### Zod Schema Performance
- Zod parsing adds ~5-10ms overhead per validation
- Cache schemas at module level (don't recreate)
- Use `.transform()` sparingly
- Consider `.strict()` for strict validation

### Optimization Tips
```typescript
// ❌ SLOW - Creates new schema each time
function validate(data: unknown) {
    const schema = z.object({ name: z.string() });
    return schema.parse(data);
}

// ✅ FAST - Reuses schema
const userSchema = z.object({ name: z.string() });

function validate(data: unknown) {
    return userSchema.parse(data);
}
```

---

## Best Practices

### 1. Prefer Type Guards Over Casts
```typescript
// ❌ BAD
return (value as any).property;

// ✅ GOOD
if (hasProperty(value, 'property')) {
    return value.property;
}
```

### 2. Use Zod for External Data
```typescript
// ✅ GOOD - Validate API responses
const ApiResponseSchema = z.object({
    data: z.array(z.unknown()),
    status: z.number()
});

const response = await fetch(url);
const json: unknown = await response.json();
const parsed = ApiResponseSchema.parse(json);
```

### 3. Document Why Casts Are Necessary
```typescript
// ✅ GOOD - Justified cast with comment
// This cast is safe because we validated the structure above
return result as SpecificType;
```

### 4. Leverage Generic Constraints
```typescript
// ✅ GOOD - Use constraints
function process<T extends { id: string }>(item: T): string {
    return item.id;  // Type-safe
}
```

---

## Related Documentation

- [TypeScript Strict Mode Guide](../typescript/strict-mode-guide.md)
- [ESLint Rules Reference](./eslint-rules-reference.md)
- [Type System Architecture](../typescript/type-system-architecture-standardization.md)
- [AsyncResult Pattern Guide](../user-guides/asyncresult-pattern-complete-guide.md)
- [Zod Validation Guide](../development/zod-validation-guide.md)

---

## Appendix: Search Commands

### Find All Violations

```bash
# Pattern 1: as any casts
grep -r "return.*as any" src/ | wc -l

# Pattern 2: as T casts  
grep -r "return.*as T" src/ | wc -l

# Pattern 3: JSON.parse casts
grep -r "JSON\.parse.*as" src/ | wc -l

# Pattern 4: Double casts
grep -r "as unknown as" src/ | wc -l

# Pattern 5: Property access
grep -r "\(.*as any\)\[" src/ | wc -l

# Pattern 6: Error property access
grep -r "(error as any)\." src/ | wc -l
```

### AST-Grep Patterns

```bash
# Find functions with unsafe returns
ast-grep --pattern 'function $NAME($$$): $TYPE { $$$ return $VAR as any; $$$ }' src/

# Find generic functions with casts
ast-grep --pattern 'function $NAME<$T>($$$): $TYPE { $$$ return $VAR as $T; $$$ }' src/

# Find JSON.parse with casts
ast-grep --pattern 'JSON.parse($STR) as $TYPE' src/
```

---

*End of Pattern Catalog*
