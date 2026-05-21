# Id Type Standardization

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Id Type Standardization

---
# ID Type Standardization

This document outlines the approach for standardizing ID type handling throughout the Mugiwara-Kaizoku application.

## Problem

The application uses a shared `ID` type defined as `number | string` in `src/types/shared-types.ts`. This flexibility leads to inconsistent handling of IDs across the codebase, particularly when:

1. Passing IDs to API calls that expect a specific type (usually number)
2. Using IDs in URLs (which expect string)
3. Comparing IDs for equality (which can fail if types don't match)
4. Type checking and narrowing IDs in conditional logic

## Solution

We've implemented a standardized approach to ID handling using utility functions in `src/utils/idUtils.ts`.

### 1. Utility Functions

- `toNumericId(id: ID): number` - Converts any ID to a number format
- `toStringId(id: ID): string` - Converts any ID to a string format
- `isNumericId(id: ID): id is number` - Type guard to check if an ID is a number
- `isStringId(id: ID): id is string` - Type guard to check if an ID is a string
- `isValidId(value: unknown): value is ID` - Validates if a value is a valid ID type
- `hasValidId(obj: unknown): obj is { id: ID }` - Type guard for objects with an id property

### 2. Usage Patterns

#### For API Calls

```typescript
// Convert ID to numeric form for API calls expecting a number
const result = await apiMutation.mutateAsync({
  id: toNumericId(entity.id),
  // other params...
});
```

#### For URL Navigation

```typescript
// Convert ID to string form for URL paths
const entityIdForUrl = toStringId(entity.id);
router.push(`/entity/${entityIdForUrl}`);
```

#### For ID Comparisons

```typescript
// Compare IDs after converting to consistent format
if (toStringId(entity1.id) === toStringId(entity2.id)) {
  // IDs match
}
```

#### For Type Checking

```typescript
// Verify if an object has a valid ID property
if (hasValidId(obj)) {
  // Safe to use obj.id
  const id = obj.id;
}
```

### 3. Implementation Strategy

1. **Component Updates**: Updated React components that interact with APIs to use `toNumericId` for API calls and `toStringId` for URL paths
2. **Type Assertion Replacements**: Replaced manual type assertions like `typeof id === 'string' ? parseInt(id, 10) : id` with utility functions
3. **Consistent URL Handling**: Updated URL navigation to always use string IDs
4. **Type Guards**: Implemented proper type guards for ID validation

## Key Files Updated

- `src/components/library/LibraryList.tsx`
- `src/components/library/EditLibraryModal.tsx`
- `src/components/manga/MangaDetailView.tsx`
- `src/components/library/CreateLibraryModal.tsx`

## Benefits

- **Consistency**: Standardized approach for handling ID types
- **Type Safety**: Better TypeScript type checking with proper type guards
- **Maintainability**: Centralized ID conversion logic
- **Error Prevention**: Reduces risks of type mismatches when calling APIs

## Future Work

- Update remaining components to use the ID utility functions
- Add unit tests for the ID utility functions
- Consider implementing a more robust ID type system (e.g., branded types)