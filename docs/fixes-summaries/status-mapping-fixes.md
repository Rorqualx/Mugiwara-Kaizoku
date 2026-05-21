# Status Mapping Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Status Mapping Fixes

---
# Status Mapping Fixes

## Overview

This document describes the fix for the `CommonMangaStatus` reference issue in the `type-conversion.ts` file. The issue was that `CommonMangaStatus` was being used as a value (with `Object.values()`) when it's only defined as a type, not an enum.

## Issue Identified

In `src/utils/type-conversion.ts`, TypeScript reported the error:

```
CommonMangaStatus only refers to a type, but is being used as a value here
```

This occurred because:

1. `CommonMangaStatus` is defined in `src/types/common.ts` as a type union:
   ```typescript
   export type MangaStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ERROR' | 'DELETED';
   ```

2. In `type-conversion.ts`, it was being used with `Object.values()` as if it were an enum or object:
   ```typescript
   Object.values(CommonMangaStatus).includes(status as CommonMangaStatus)
   ```

3. Type unions in TypeScript don't exist at runtime, so this would fail when executed.

## Implementation Strategy

### 1. Create a Runtime Value Array

Added a constant array containing the values of the `CommonMangaStatus` type union for runtime use:

```typescript
// Define the values of CommonMangaStatus for runtime use
const CommonMangaStatusValues: string[] = [
  'PENDING', 'ACTIVE', 'COMPLETED', 'ERROR', 'DELETED'
];
```

### 2. Update the Status Checking Logic

Modified the status checking logic to use the array of values instead of `Object.values()`:

```typescript
// Before:
if (
  Object.values(DomainMangaStatus).includes(status as DomainMangaStatus) ||
  Object.values(PrismaMangaStatus).includes(status as PrismaMangaStatus) ||
  Object.values(CommonMangaStatus).includes(status as CommonMangaStatus)
) {
  return status as DomainMangaStatus;
}

// After:
if (
  Object.values(DomainMangaStatus).includes(status as DomainMangaStatus) ||
  Object.values(PrismaMangaStatus).includes(status as PrismaMangaStatus) ||
  CommonMangaStatusValues.includes(status as string)
) {
  return status as DomainMangaStatus;
}
```

## Benefits of the Fix

1. **Type Correctness**: The code now correctly distinguishes between types and values
2. **Runtime Safety**: The array provides the correct values at runtime
3. **Maintainability**: If the `CommonMangaStatus` type changes, we only need to update both the type and the array
4. **Consistency**: The solution follows TypeScript best practices for handling union types at runtime

## Lessons Learned

When working with TypeScript, it's important to remember:

1. Type unions (`type A = 'x' | 'y'`) exist only at compile time
2. For runtime checks, create constants with the same values
3. Enums (`enum A { X = 'x', Y = 'y' }`) can be used as both types and values
4. When using imported types, verify whether they're runtime values or compile-time types

This fix ensures that status mapping works correctly while maintaining type safety and runtime compatibility.