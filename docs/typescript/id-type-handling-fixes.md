# Id Type Handling Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Id Type Handling Fixes

---
# ID Type Handling Fixes

## Background

The codebase has inconsistent handling of ID types across different components. The issue arises because:

1. The domain types define `ID` as a union type of `string | number`
2. Database operations typically require numeric IDs
3. UI/URL handling typically uses string IDs

This leads to TypeScript errors when passing IDs between components without proper conversion.

## Approach

We've applied a consistent pattern for ID handling:

1. Use `toNumericId(id)` from `idUtils.ts` for converting IDs to numbers before:
   - Making API calls to the backend
   - Storing IDs in state that expects numbers
   - Comparing IDs that might be of different types

2. Use `String(id)` or `toStringId(id)` from `idUtils.ts` for converting IDs to strings before:
   - Using IDs in URL paths
   - Displaying IDs in the UI

## Fixed Files

1. `src/components/library/LibraryList.tsx`:
   - Added `toNumericId(library.id)` for `selectLibrary` call to convert ID to number for store operations

2. `src/components/library/LibraryCard.tsx`:
   - Added `toNumericId(library.id)` for comparing with `selectedLibraryId` from store
   - Imported `toNumericId` utility function

3. `src/components/updateManga/ProviderSelectionForm.tsx`:
   - Added robust ID validation and conversion in the `handleSave` method
   - Ensured numeric ID is used for API calls

4. `src/components/manga/MangaDetailView.tsx`:
   - Improved the enabled logic for trpc.settings.metadata.getConflicts.useQuery

## Pattern for ID Conversion

```typescript
// Converting ID to number for API calls or store operations
const numericId = toNumericId(entity.id);

// Converting ID to string for URLs or display
const stringId = String(entity.id); // or toStringId(entity.id);

// Comparing IDs safely
const isMatch = numericId === otherNumericId;
// or
const isMatch = String(id1) === String(id2);
```

## Best Practices

1. Always convert IDs to the appropriate type before using them
2. Use the utility functions in `idUtils.ts` for consistent conversion
3. Validate IDs before using them in API calls
4. Use strict type checking with `===` instead of loose equality `==`
5. Document the expected ID type in function parameters and return types
