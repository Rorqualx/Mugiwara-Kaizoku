# Typescript Patterns

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Patterns

---
# TypeScript Patterns Reference

This document provides a reference for common TypeScript patterns used in the Mugiwara-Kaizoku project to maintain type safety.

## 1. Type Guards

Type guards are functions that check if a value is of a specific type at runtime. They help TypeScript narrow down types.

### Pattern

```typescript
function isType<T>(value: unknown): value is T {
  // Check if value has the shape of T
  return (
    value !== null &&
    typeof value === 'object' &&
    // Check for specific properties that T should have
    'propertyA' in value &&
    'propertyB' in value
  );
}
```

### Example from codebase

```typescript
function isFileSystemDirectoryHandle(obj: unknown): obj is FileSystemDirectoryHandle {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'name' in obj &&
    'kind' in obj &&
    (obj as { kind: string }).kind === 'directory'
  );
}
```

## 2. Safe Type Assertions

When TypeScript can't infer types correctly but you're confident about the type structure, use a two-step casting approach.

### Pattern

```typescript
const safeValue = value as unknown as TargetType;
```

### Example from codebase

```typescript
useLibraryStore.getState().setLibraries(libraryListQuery.data as unknown as Library[]);
```

## 3. Null Handling

### Pattern

```typescript
// Optional chaining
const value = obj?.property?.subProperty;

// Nullish coalescing (for defaults)
const name = data?.name ?? 'Unknown';

// Safe type narrowing
if (value !== null && value !== undefined) {
  // TypeScript knows value is non-null here
}
```

### Example from codebase

```typescript
const entityName = entityDetails.mangaTitle || 
                  entityDetails.chapterTitle || 
                  entityDetails.libraryName || 
                  entityDetails.taskType ||
                  `${event.relatedEntityType} ${event.relatedEntityId}`;
```

## 4. Discriminated Unions

Use a common property (the "discriminant") to differentiate between union types.

### Pattern

```typescript
type Result<T> = 
  | { status: 'success'; data: T } 
  | { status: 'error'; error: string };

function handleResult<T>(result: Result<T>) {
  if (result.status === 'success') {
    // TypeScript knows we have result.data here
    console.log(result.data);
  } else {
    // TypeScript knows we have result.error here
    console.error(result.error);
  }
}
```

## 5. Function Overloads

Use function overloads to define multiple type signatures for the same function.

### Pattern

```typescript
function process(value: string): string;
function process(value: number): number;
function process(value: string | number): string | number {
  if (typeof value === 'string') {
    return value.toUpperCase();
  } else {
    return value * 2;
  }
}
```

## 6. Generics

Use generics to create reusable components that work with different types.

### Pattern

```typescript
function identity<T>(arg: T): T {
  return arg;
}

// Usage
const str = identity<string>("hello");
const num = identity<number>(42);
```

### Example from codebase

```typescript
function trackApiCall<T>(
  endpoint: string, 
  promise: Promise<T>
): Promise<T> {
  // Implementation...
}
```

## 7. Utility Types

TypeScript provides utility types for common transformations.

### Common Utility Types

```typescript
// Make all properties optional
type PartialUser = Partial<User>;

// Extract only specified properties
type UserCredentials = Pick<User, 'username' | 'password'>;

// Omit specified properties
type PublicUser = Omit<User, 'password'>;

// Make all properties required
type RequiredUser = Required<User>;

// Extract return type of a function
type Result = ReturnType<typeof myFunction>;
```

## 8. Type Assertions for External APIs

For external APIs like browser APIs that TypeScript doesn't fully support:

### Pattern

```typescript
// For Window APIs
const api = (window as any).unsupportedAPI;

// With safety check
if ('unsupportedAPI' in window) {
  const api = (window as any).unsupportedAPI;
}
```

### Example from codebase

```typescript
const dirHandle = await (window as any).showDirectoryPicker({
  mode: 'readwrite',
});
```

## 9. React Component Props

Define props interfaces for React components.

### Pattern

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

function Button({ label, onClick, variant = 'primary', disabled = false }: ButtonProps) {
  // Implementation...
}
```

## 10. Error Handling

Type-safe error handling for async operations.

### Pattern

```typescript
try {
  // Async operation
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
}
```

### Example from codebase

```typescript
try {
  // Operation
} catch (error) {
  console.error('Sync failed:', error);
  setError(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
}
```

## Best Practices

1. **Avoid `any`**: Use `unknown` with type guards instead of `any` when possible
2. **Add JSDoc comments**: Document functions, especially those with complex types
3. **Use strict null checks**: Avoid `!` (non-null assertion) in favor of proper checks
4. **Create type definitions**: Define types for complex data structures
5. **Be consistent**: Follow established patterns throughout the codebase
6. **Add tests**: Test type conversions to ensure they handle edge cases correctly