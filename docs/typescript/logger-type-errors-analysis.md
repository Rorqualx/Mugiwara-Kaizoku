# Logger Type Errors Analysis

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Logger Type Errors Analysis

---
# Analysis of Logger Type Errors in Adapter Classes

## Error Patterns Identified

After examining the TypeScript errors from running `tsc --noEmit`, I've identified a recurring pattern related to logger implementation in adapter classes. This document outlines the specific errors, their root causes, and potential solutions.

## Common Error Types

### 1. Logger Property Type Mismatch

```
Property 'log' in type 'AniListAdapter' is not assignable to the same property in base type 'BaseIntegrationAdapter<AniListAdapterConfig>'.
  Type 'Logger' is not assignable to type '(message: string, error?: unknown) => void'.
    Type 'Logger' provides no match for the signature '(message: string, error?: unknown): void'.
```

This error occurs in:
- `src/api/metadataProviders/adapters/anilistAdapter.fixed.ts` (line 84)
- `src/api/metadataProviders/adapters/anilistAdapter.fixed.updated.ts` (line 84)
- `src/api/metadataProviders/adapters/comicvineAdapter.fixed.ts` (line 40)

### 2. Non-callable Logger Expression

```
This expression is not callable.
  Type 'Logger' has no call signatures.
```

This error occurs multiple times in:
- `src/api/metadataProviders/adapters/anilistAdapter.fixed.ts` (lines 172, 212, 255, 352, 396, 402, 438)
- `src/api/metadataProviders/adapters/anilistAdapter.fixed.updated.ts` (same lines)
- `src/api/metadataProviders/adapters/comicvineAdapter.fixed.ts` (lines 129, 151, 204, 232, etc.)

## Root Causes

### 1. Type Conflict Between BaseIntegrationAdapter and Logger Interface

In `src/utils/integration-adapter.ts`, the base adapter class defines a log method:

```typescript
protected log(message: string, error?: unknown): void {
  console.error(`[${this.source}] ${message}`, error instanceof Error ? error.message : String(error));
}
```

However, in the derived classes, they try to override this with a Logger instance:

```typescript
protected override log = logger.child({ module: 'AniListAdapter' });
```

The issue is that the Logger interface in `src/utils/logging.ts` doesn't match the method signature expected by the base class:

```typescript
interface Logger {
  info: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  child: (options: Record<string, unknown>) => Logger;
}
```

### 2. Logger Interface Has No Direct Call Signature

The Logger interface doesn't have a direct call signature, which is why attempts to call it directly (`this.log('message', error)`) fail. The Logger interface only has methods like `error`, `info`, etc., but is not directly callable.

## Affected Files and Code Patterns

### Pattern 1: Overriding log property with Logger instance

```typescript
// In derived adapter classes
protected override log = logger.child({ module: 'AdapterName' });
```

### Pattern 2: Attempting to call log directly

```typescript
// Throughout adapter methods
this.log('Error message', error);
```

### Affected Files

1. `src/api/metadataProviders/adapters/anilistAdapter.fixed.ts`
2. `src/api/metadataProviders/adapters/anilistAdapter.fixed.updated.ts`
3. `src/api/metadataProviders/adapters/comicvineAdapter.fixed.ts`
4. `src/utils/integration-adapter.ts` (base implementation)
5. `src/utils/logging.ts` (Logger interface definition)

## Potential Solution Approaches

### Option 1: Method Overriding with Delegation

Instead of replacing the log property, properly override the method to delegate to the logger:

```typescript
private loggerInstance = logger.child({ module: 'AdapterName' });

protected override log(message: string, error?: unknown): void {
  this.loggerInstance.error(message, error ? String(error) : undefined);
}
```

### Option 2: Update Logger Interface

Modify the Logger interface to include a call signature:

```typescript
interface Logger {
  (message: string, error?: unknown): void;
  info: (obj: unknown, msg?: string) => void;
  // ... other methods
}
```

### Option 3: Adapter Pattern

Create an adapter function that converts between the different parameter styles:

```typescript
protected createLoggerAdapter(logger: Logger): (message: string, error?: unknown) => void {
  return (message: string, error?: unknown) => {
    logger.error(message, error);
  };
}
```

## Recommended Approach

Option 1 (Method Overriding with Delegation) is the most straightforward and type-safe solution that requires minimal changes to the codebase. It maintains the existing interface contracts while properly implementing inheritance relationships.

## Additional Observations

1. This pattern appears in multiple adapter classes, suggesting it's a systematic issue in how logging is implemented in adapter classes.

2. The error only appears when strict TypeScript checking is enabled, which explains why it might have been overlooked previously.

3. Similar patterns might exist in other parts of the codebase where Logger instances are used in inheritance hierarchies.

## Next Steps

1. Choose and implement a consistent approach across all adapter classes
2. Add documentation about the proper pattern for logger usage in adapter classes
3. Consider adding eslint rules to prevent similar issues in the future