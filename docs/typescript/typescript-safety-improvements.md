# Typescript Safety Improvements

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Safety Improvements

---
# TypeScript Safety Improvements

This document outlines the type safety improvements implemented in the Mugiwara-Kaizoku codebase and provides guidelines for maintaining type safety in future development.

## Table of Contents

1. [Overview](#overview)
2. [Type Safety Patterns](#type-safety-patterns)
3. [Discriminated Unions](#discriminated-unions)
4. [Error Handling](#error-handling)
5. [Null Safety](#null-safety)
6. [Type Guards](#type-guards)
7. [Best Practices](#best-practices)

## Overview

We've implemented several improvements to enhance TypeScript type safety throughout the codebase:

1. **Replaced unsafe type assertions** with proper type guards
2. **Added discriminated unions** for complex type relationships
3. **Created specialized error types** for better error handling
4. **Implemented null safety patterns** with optional chaining and nullish coalescing
5. **Added generic type parameters** to improve type inference

These changes reduce the risk of runtime errors, improve code maintainability, and provide better developer experience through enhanced IDE autocompletion and type checking.

## Type Safety Patterns

### Avoiding Type Assertions

We've replaced unsafe type assertions (`as any`, `as unknown as T`) with safer alternatives:

```typescript
// ❌ Avoid this
const result = someValue as unknown as ComplexType;

// ✅ Do this instead
if (isComplexType(someValue)) {
  const result: ComplexType = someValue;
  // Use result safely
}
```

### Conversion Functions

For complex types, we've implemented conversion functions that validate data before typing:

```typescript
// In src/server/db/prisma.ts
function convertToTaskWithRelations(task: unknown): TaskWithRelations {
  // Validate and convert task data
  // Return properly typed TaskWithRelations
}
```

### Generic Type Parameters

We've added generic type parameters to improve type inference:

```typescript
// In src/utils/dataFetching.ts
interface TimestampedEntity<T = Record<string, unknown>> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

function isTimestampedEntity<T = Record<string, unknown>>(
  obj: unknown,
  extraCheck?: (obj: Record<string, unknown>) => boolean
): obj is TimestampedEntity<T> {
  // Implementation
}
```

## Discriminated Unions

We've implemented discriminated union types to provide type safety when working with related but distinct types.

### Task Union Types

We created comprehensive task union types in `src/types/task-unions.ts` that provide type safety based on both task type and status:

```typescript
type TaskUnion = 
  | CheckChaptersTask
  | UpdateMetadataTask
  | FixOutOfSyncTask
  | NotifyTask
  | BackupTask;
```

Each task type has specific properties based on its discriminant:

```typescript
// Example usage
function processTask(task: TaskUnion) {
  if (isCheckChaptersTask(task)) {
    // TypeScript knows this is a CheckChaptersTask
    console.log(task.checkChaptersPayload.mangaId);
  } else if (isUpdateMetadataTask(task)) {
    // TypeScript knows this is an UpdateMetadataTask
    console.log(task.updateMetadataPayload.source);
  }
}
```

### Type Guards for Discriminated Unions

We've provided type guards for all discriminated unions:

```typescript
export function isCheckChaptersTask(task: TaskUnion): task is CheckChaptersTask {
  return task.type === TaskType.CHECK_CHAPTERS;
}

export function isPendingTask<T extends TaskUnion>(task: T): task is T & { status: TaskStatus.PENDING } {
  return task.status === TaskStatus.PENDING;
}
```

## Error Handling

We've created specialized error types in `src/types/error-types.ts` to improve error handling throughout the application.

### Error Type Hierarchy

```
AppError
├── NetworkError
├── ApiError
├── DatabaseError
├── ValidationError
├── ConfigurationError
├── IntegrationError
├── TaskError
├── PermissionError
└── NotFoundError
```

### Using Error Types

```typescript
try {
  // Attempt operation
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

### Error Utilities

We've provided utility functions for consistent error handling:

```typescript
// Convert any error to a typed AppError
const appError = toAppError(error);

// Get detailed error information for logging
const errorDetails = getErrorDetails(error);

// Format error for API responses
const errorResponse = formatErrorResponse(error);
```

## Null Safety

We've implemented null safety patterns throughout the codebase to prevent null reference errors.

### Optional Chaining

```typescript
// ❌ Avoid this
const title = manga && manga.metadata && manga.metadata.title;

// ✅ Do this instead
const title = manga?.metadata?.title;
```

### Nullish Coalescing

```typescript
// ❌ Avoid this (uses '' for any falsy value)
const title = manga.title || 'Unknown';

// ✅ Do this instead (only uses default for null/undefined)
const title = manga.title ?? 'Unknown';
```

### Example from MangaDetailView.tsx

```typescript
// Calculate total size of manga with null safety
const totalSize = manga.chapters?.reduce((sum, chapter) => sum + (chapter?.size ?? 0), 0) ?? 0;

// Format status for display with nullish coalescing
const formattedStatus = manga.metadata?.status ?? 'Unknown';
```

## Type Guards

We've implemented comprehensive type guards for safer type checking.

### Basic Type Guards

```typescript
function isArray<T>(
  value: unknown,
  elementGuard?: (item: unknown) => item is T
): value is T[] {
  if (!Array.isArray(value)) return false;
  if (!elementGuard) return true;
  return value.every(elementGuard);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
```

### Complex Type Guards

```typescript
function isValidMetadataProvider(source: unknown): source is MetadataProvider {
  if (!source || typeof source !== 'object') return false;
  const src = source as Record<string, unknown>;
  return (
    'id' in src && typeof src.id === 'string' &&
    'name' in src && typeof src.name === 'string' &&
    'status' in src && typeof src.status === 'string'
  );
}
```

## Best Practices

Follow these best practices to maintain type safety in the codebase:

### 1. Avoid Type Assertions

Avoid using `as` type assertions whenever possible. Use type guards instead:

```typescript
// ❌ Avoid
const user = data as User;

// ✅ Do this
if (isUser(data)) {
  const user: User = data;
  // ...
}
```

### 2. Handle Nulls Safely

Always use optional chaining (`?.`) and nullish coalescing (`??`) when dealing with potentially null/undefined values:

```typescript
// ❌ Avoid
const name = user && user.profile && user.profile.name || 'Anonymous';

// ✅ Do this
const name = user?.profile?.name ?? 'Anonymous';
```

### 3. Use Discriminated Unions

Use discriminated unions for complex type relationships:

```typescript
type Result<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function handleResult<T>(result: Result<T>) {
  if (result.status === 'success') {
    // TypeScript knows result.data exists here
    processData(result.data);
  } else {
    // TypeScript knows result.error exists here
    handleError(result.error);
  }
}
```

### 4. Implement Type Guards

Create proper type guards for complex types:

```typescript
function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    'id' in obj && typeof obj.id === 'number' &&
    'name' in obj && typeof obj.name === 'string' &&
    'email' in obj && typeof obj.email === 'string'
  );
}
```

### 5. Use Specific Error Types

Use specific error types for better error handling:

```typescript
try {
  // Operation that might fail
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle network error
  } else if (error instanceof ValidationError) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

### 6. Avoid any

Avoid using `any` type whenever possible. Use `unknown` for values of uncertain type, then narrow with type guards:

```typescript
// ❌ Avoid
function processData(data: any) {
  // Unsafe access to data properties
}

// ✅ Do this
function processData(data: unknown) {
  if (isValidData(data)) {
    // Safe access to data properties
  }
}
```

### 7. Document Type Constraints

Document complex type relationships and constraints with JSDoc comments:

```typescript
/**
 * Task payload for updating metadata
 * @property {number} mangaId - ID of the manga to update
 * @property {string} [source] - Optional source to pull metadata from
 * @property {boolean} [forceUpdate] - Whether to force update even if recently updated
 */
interface UpdateMetadataPayload {
  mangaId: number;
  source?: string;
  forceUpdate?: boolean;
}
```

By following these patterns and best practices, we can maintain type safety throughout the codebase and reduce the risk of runtime errors.