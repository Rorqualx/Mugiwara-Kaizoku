# Trpc Type Instantiation Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Trpc Type Instantiation Fix

---
# TRPC Deep Type Instantiation Error Fix

## Problem

The component `ProviderSelectionForm.tsx` was experiencing a TypeScript error:

```
Type instantiation is excessively deep and possibly infinite
```

This error occurs when TypeScript's type system attempts to resolve a recursive or circular type reference, and the recursion depth becomes too large, potentially infinite. 

In our case, this was happening with the TRPC mutation:

```typescript
const updateProviderPreferencesMutation = trpc.manga.updateProviderPreferences.useMutation({
  // ...options
});
```

The complex return type of the TRPC mutation, combined with deeply nested generic types from the TRPC library, was causing TypeScript to reach its maximum type instantiation depth.

## Solution

The solution was to explicitly specify the generic type parameters for the `useMutation` call, using `unknown` type to prevent the deep type instantiation:

```typescript
// Define a simpler interface for the preference input shape
interface UpdateProviderPreferencesInput {
  id: number;
  preferences: Record<string, { provider: string; value: unknown }>;
}

// Fix for "Type instantiation is excessively deep and possibly infinite" error:
// 1. We're explicitly specifying only the input type parameter to useMutation
// 2. We're leaving the TData (output) and TError types to be inferred by TRPC
// 3. This breaks any potential circular type references causing the infinite type instantiation
const updateProviderPreferencesMutation = trpc.manga.updateProviderPreferences.useMutation<
  unknown, // Use unknown instead of any for better type safety
  unknown,
  UpdateProviderPreferencesInput 
>({
  // ...options
});
```

### Key Improvements:

1. **Explicit Type Parameters**: By explicitly providing the generic type parameters to `useMutation`, we override the deep type inference that was causing issues.

2. **Using `unknown` Type**: Using `unknown` for the output and error types prevents TypeScript from needing to fully resolve these potentially complex types.

3. **Input Type Definition**: We created a clear interface for the input type that matches the schema defined in the manga router.

## Why This Works

TRPC uses complex generic types to provide end-to-end type safety between the server and client. Sometimes these types can become deeply nested, especially when there are circular references in the database schema or returned types.

By explicitly providing simpler type parameters, we're essentially telling TypeScript "don't try to infer these complex types, use these simpler ones instead." This prevents the type system from trying to resolve deep recursive references.

Using `unknown` is better than `any` because it maintains type safety by requiring explicit type checking before using the values, while still preventing the deep type instantiation.

## Alternatives Considered

1. **Using `any` for all type parameters**: This would work but would sacrifice type safety.

2. **Adding explicit type annotations to the mutation options**: We attempted this initially but it still led to the same error due to the deep instantiation issue.

3. **Modifying the server-side TRPC router**: This would be a more comprehensive but invasive solution, potentially affecting other components.

The chosen solution offers the best balance of fixing the issue while maintaining type safety and minimizing changes to the codebase.