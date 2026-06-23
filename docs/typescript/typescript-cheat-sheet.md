# TypeScript Safety Cheat Sheet

A quick reference guide for maintaining type safety in the Mugiwara-Kaizoku codebase.

## Type Guards

### Basic Type Guards

```typescript
// Check if value is non-null object
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Check if value is array
function isArray<T>(
  value: unknown,
  elementGuard?: (item: unknown) => item is T
): value is T[] {
  if (!Array.isArray(value)) return false;
  if (!elementGuard) return true;
  return value.every(elementGuard);
}

// Check if value is string
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Check if value is number
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

// Check if value is boolean
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// Check if value is Date
function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}
```

### Complex Type Guards

```typescript
// Check if value matches interface
function isUser(value: unknown): value is User {
  if (!isObject(value)) return false;
  
  return (
    'id' in value && isNumber(value.id) &&
    'name' in value && isString(value.name) &&
    'email' in value && isString(value.email)
  );
}

// Check if value has required properties
function hasRequiredProperties<T extends Record<string, unknown>>(
  value: unknown,
  requiredProps: (keyof T)[]
): value is T {
  if (!isObject(value)) return false;
  
  return requiredProps.every(prop => prop in value);
}
```

## Null Safety

### Optional Chaining

```typescript
// Access potentially null/undefined properties
const title = manga?.metadata?.title;
const count = chapters?.length;
const first = array?.[0];
const result = func?.();
```

### Nullish Coalescing

```typescript
// Provide default for null/undefined values
const title = manga?.metadata?.title ?? 'Unknown';
const count = chapters?.length ?? 0;
const enabled = options.enabled ?? true;
```

### Optional Parameters

```typescript
function processUser(user: User, options?: { sendEmail?: boolean }) {
  const shouldSendEmail = options?.sendEmail ?? false;
  // ...
}
```

## Discriminated Unions

### Creating Discriminated Unions

```typescript
// Define union with discriminant property
type Result<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
  | { status: 'loading' };

// Use type narrowing with discriminant
function handleResult<T>(result: Result<T>) {
  if (result.status === 'success') {
    // TypeScript knows result.data exists here
    processData(result.data);
  } else if (result.status === 'error') {
    // TypeScript knows result.error exists here
    handleError(result.error);
  } else {
    // TypeScript knows result.status is 'loading'
    showLoadingIndicator();
  }
}
```

### Type Guards for Discriminated Unions

```typescript
function isSuccessResult<T>(result: Result<T>): result is (Result<T> & { status: 'success' }) {
  return result.status === 'success';
}

function isErrorResult<T>(result: Result<T>): result is (Result<T> & { status: 'error' }) {
  return result.status === 'error';
}

// Usage
if (isSuccessResult(result)) {
  processData(result.data);
}
```

## Error Handling

### Type-Safe Error Handling

```typescript
try {
  // Operation that might fail
} catch (error) {
  if (isApiError(error)) {
    // Handle API error specifically
    console.error(`API Error on ${error.endpoint}: ${error.message}`);
  } else if (isDatabaseError(error)) {
    // Handle database error specifically
    console.error(`Database Error during ${error.operation}: ${error.message}`);
  } else {
    // Handle other errors
    console.error(`Unexpected error: ${getErrorMessage(error)}`);
  }
}
```

### Safe Error Message Extraction

```typescript
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Unknown error occurred';
}
```

## Generic Type Parameters

### Basic Generics

```typescript
// Generic function
function getFirst<T>(array: T[]): T | undefined {
  return array[0];
}

// Generic with constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Advanced Generics

```typescript
// Generic with default type
function processEntity<T = Record<string, unknown>>(entity: T): T {
  // Process entity
  return entity;
}

// Conditional types
type NonNullableProperties<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

// Mapped types
type ReadonlyDeep<T> = {
  readonly [P in keyof T]: T[P] extends object ? ReadonlyDeep<T[P]> : T[P];
};
```

## Type Assertions (Use Sparingly)

### When Type Guards Aren't Possible

```typescript
// ONLY use when you can guarantee the type is correct
// and there's no way to express it with type guards
const config = JSON.parse(configString) as Config;

// Always prefer type guards when possible
if (isConfig(parsedConfig)) {
  const config: Config = parsedConfig;
  // Use config safely
}
```

### Type Assertion with Validation

```typescript
function assertIsConfig(value: unknown): asserts value is Config {
  if (!isObject(value)) {
    throw new Error('Value is not an object');
  }
  
  if (!('apiKey' in value && typeof value.apiKey === 'string')) {
    throw new Error('Value is not a valid Config');
  }
}

// Usage
const parsedConfig = JSON.parse(configString);
assertIsConfig(parsedConfig);
// TypeScript now knows parsedConfig is Config
```

## API Response Handling

### Type-Safe API Responses

```typescript
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
};

function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

// Usage
const response = await fetchData();
if (isSuccessResponse(response)) {
  // TypeScript knows response.data exists and is of type T
  processData(response.data);
} else {
  // Handle error case
  handleError(response.error?.message ?? 'Unknown error');
}
```

## Useful Commands

```bash
# Type check entire project
npx tsc --noEmit

# Type check specific file
npx tsc --noEmit path/to/file.ts

# Watch mode for type checking
npx tsc --noEmit --watch
```

## Further Reading

For more detailed information, refer to:

- TypeScript Safety Improvements
- TypeScript Maintenance Plan
- TypeScript Escape Hatches