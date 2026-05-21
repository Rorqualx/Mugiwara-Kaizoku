# Logger Adapter Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Logger Adapter Fixes

---
# Logger Adapter Fixes

## Problem Description

The AniList adapter (and other adapter classes) had TypeScript errors related to the `log` property. The primary issues were:

1. The Logger type from `src/utils/logging.ts` was not compatible with the method signature in `BaseIntegrationAdapter`
2. The `Logger` interface defined in `logging.ts` had no call signatures, resulting in errors when the logger was called directly

## Error Details

The specific TypeScript errors were:

```
Property 'log' in type 'AniListAdapter' is not assignable to the same property in base type 'BaseIntegrationAdapter<AniListAdapterConfig>'.
  Type 'Logger' is not assignable to type '(message: string, error?: unknown) => void'.
    Type 'Logger' provides no match for the signature '(message: string, error?: unknown): void'.
```

And when using the logger:

```
This expression is not callable.
  Type 'Logger' has no call signatures.
```

## Solution

The solution implemented involves:

1. Modifying the class structure to use proper inheritance patterns
2. Using composition with the logger instead of direct property overriding
3. Properly implementing the log method to maintain compatibility with the base class

### Implementation Details

1. In the base adapter class:
   - Keep the log method as a normal instance method with the function signature `(message: string, error?: unknown) => void`

2. In the derived adapter classes:
   - Create a private logger instance using `logger.child({ module: 'AdapterName' })`
   - Override the log method to use this logger instance but maintain the same method signature

### Code Changes

#### BaseIntegrationAdapter (base class)
```typescript
protected log(message: string, error?: unknown): void {
  console.error(`[${this.source}] ${message}`, error instanceof Error ? error.message : String(error));
}
```

#### AniListAdapter (derived class)
```typescript
private loggerInstance = logger.child({ module: 'AniListAdapter' });

/**
 * Override the log method to use the logger instance
 * 
 * @param message - The message to log
 * @param error - Optional error object
 */
protected override log(message: string, error?: unknown): void {
  this.loggerInstance.error(message, error ? String(error) : undefined);
}
```

## Benefits of This Approach

1. **Type Safety**: The solution maintains proper type compatibility between base and derived classes
2. **Composition over Inheritance**: Uses composition with the logger instance rather than trying to override a property with an incompatible type
3. **Method Signature Compatibility**: Maintains the same method signature, ensuring derived classes properly implement the contract of the base class
4. **Clear Documentation**: The override keyword clearly indicates the method is overriding a base class method

## Affected Files

- `src/utils/integration-adapter.fixed.ts`
- `src/api/metadataProviders/adapters/anilistAdapter.fixed.updated.ts`
- `src/api/metadataProviders/adapters/comicvineAdapter.fixed.ts`

## Patterns for Other Adapters

This same pattern should be applied to other adapter classes that extend `BaseIntegrationAdapter` and encounter similar logger-related type errors. The core approach is to:

1. Create a private logger instance in the derived class
2. Override the log method to use this instance
3. Maintain the same method signature as the base class