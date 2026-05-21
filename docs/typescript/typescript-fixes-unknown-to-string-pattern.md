# Typescript Fixes Unknown To String Pattern

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Fixes Unknown To String Pattern

---
# TypeScript Fixes: Unknown to String Conversion Pattern

## Overview

This document outlines the pattern implemented for safely converting `unknown` values to `string | undefined` throughout the codebase. This pattern is critical for ensuring type safety when dealing with external data or error handling.

## The Problem

TypeScript errors were occurring throughout the codebase where `unknown` values were being directly converted to `string` or used in contexts requiring `string | undefined`. This pattern was particularly common in error handling and logging code:

```typescript
// TypeScript error: Argument of type 'unknown' is not assignable to parameter of type 'string | undefined'.
logger.error('Error occurred:', error);

// TypeScript error: Argument of type 'unknown' is not assignable to parameter of type 'string | undefined'.
const title = metadata.title;
```

These errors highlight a potential runtime issue where code assumes that values can be safely converted to strings, which might not always be the case.

## The Solution

We implemented a consistent `safeStringOrUndefined` utility function that safely converts any `unknown` value to either a `string` or `undefined`:

```typescript
/**
 * Helper function to safely convert a value to string or undefined
 * @param value - Any value to convert to string
 * @returns The value as string, or undefined if null/undefined or conversion fails
 */
export function safeStringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  
  try {
    return String(value);
  } catch (error) {
    return undefined;
  }
}
```

This utility function provides:

1. **Type Safety**: The return type is explicitly `string | undefined`, satisfying TypeScript's type checking
2. **Null/Undefined Handling**: Returns `undefined` for null or undefined values
3. **Error Recovery**: Catches and handles potential errors during string conversion
4. **Fast Path**: Optimizes for already-string values with a direct type check

## Implementation Patterns

### Pattern 1: Error Logging

```typescript
// Before
logger.error('Failed to load configuration:', error);

// After
const errorMessage = error instanceof Error ? error.message : safeStringOrUndefined(error) || 'Unknown error';
logger.error('Failed to load configuration:', errorMessage);
```

### Pattern 2: Error Handling Utilities

```typescript
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: OperationContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(
      `Error in ${context.serviceName}.${context.operationName}:`,
      safeStringOrUndefined(error) || 'Unknown error'
    );
    
    // ... error handling logic
    
    throw createContextualError(
      `Operation ${context.operationName} failed: ${getErrorMessage(error)}`,
      context
    );
  }
}
```

### Pattern 3: Enhanced Error Message Extraction

```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  
  try {
    return String(error);
  } catch (e) {
    return 'Unknown error (cannot convert to string)';
  }
}
```

### Pattern 4: API Response Handling

```typescript
if (!response || !response.ok) {
  const statusText = safeStringOrUndefined(response?.statusText) || 'Unknown error';
  throw new ApiError(
    `API error: ${statusText}`,
    response?.status,
    { ...this.errorContext, endpoint, params }
  );
}
```

## Files Modified

The pattern was implemented across several critical files:

1. **src/utils/error-handling.ts**
   - Added the `safeStringOrUndefined` utility function
   - Updated error handling utilities to use the function consistently
   - Enhanced contextual error handling with safe string conversion

2. **src/server/services/mangadex/api/adapter.ts**
   - Fixed error handling in transformToMangaDexManga and transformToMangaDexChapter
   - Updated error logging with safe string conversion
   - Added type-safe error message extraction

3. **src/server/trpc/router/search.ts**
   - Fixed error handling in search endpoints
   - Improved error message extraction
   - Updated all logger calls with safe string conversion

4. **src/server/services/config/eventMigration.ts** and **src/server/services/config/fileOrganizationMigration.ts**
   - Fixed error handling in configuration migration code
   - Added safe string conversion for error logging

## Benefits

Implementing this pattern provided several benefits:

1. **Type Safety**: Eliminated TypeScript errors related to `unknown` to `string` conversions
2. **Runtime Safety**: Prevented potential runtime errors from failed string conversions
3. **Consistent Handling**: Established a standardized approach to error handling
4. **Better Error Messages**: Improved error reporting with more accurate error information
5. **Maintainability**: Made the code more robust and easier to understand

## Best Practices

When dealing with unknown values that need to be converted to strings, follow these best practices:

1. **Always use safeStringOrUndefined** for unknown values that might not convert to strings properly
2. **Provide a fallback value** when using the result, e.g., `safeStringOrUndefined(value) || 'Default'`
3. **Check for Error instances first** to extract their message property directly
4. **Use consistent error handling patterns** throughout the codebase
5. **Document the purpose** of string conversions, especially in error handling contexts

## Conclusion

By implementing the `safeStringOrUndefined` utility and applying it consistently throughout the codebase, we've significantly improved the type safety and robustness of error handling and string conversion operations. This pattern forms an important part of our overall TypeScript improvements and error handling strategy.