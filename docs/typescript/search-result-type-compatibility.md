# Search Result Type Compatibility

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Search Result Type Compatibility

---
# Search Result Type Compatibility

## Overview

This document explains the type compatibility solutions implemented for search results in the Mugiwara-Kaizoku application. Search results from different providers (AniList, MangaDex, ComicVine, etc.) have slightly different data structures that need to be normalized to ensure type safety across the application.

## The Problem

The search functionality in our application faces several type compatibility challenges:

1. **Null vs. Undefined**: The `SearchResult` interface expects `undefined` for optional properties, but API responses may return `null`.
2. **Date Handling**: Date properties can be received as strings, Date objects, or null values.
3. **Interface Compatibility**: Context components expect a strictly typed `SearchResult[]`, while API responses may have extra or differently typed properties.
4. **Nested Properties**: API responses may contain deeply nested properties that need to be mapped to our flat interface.

## The Solution: Adapter Pattern

We've implemented the Adapter pattern to normalize search results from various sources into a consistent, type-safe format. This involves:

1. **Dedicated Adapter Module**: `src/utils/search/searchResultAdapter.ts` contains utility functions to transform raw search results.
2. **Type Definitions**: Separate interfaces for raw API responses (`RawSearchResult`) and our internal model (`SearchResult`).
3. **Normalization Functions**: Conversion functions that handle type disparities, null values, and property mapping.

## Implementation

### 1. Raw Search Result Interface

This interface represents the actual data structure returned from APIs:

```typescript
export interface RawSearchResult {
  id: string;
  title: string;
  // Allow null values as they may come from APIs
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  // ...other properties
  [key: string]: any; // Allow additional properties
}
```

### 2. Adapter Functions

Two main functions handle the conversion:

```typescript
// Convert a single result
export function adaptSearchResult(rawResult: RawSearchResult): SearchResult {
  return {
    // Convert values to expected types
    startDate: rawResult.startDate ? 
      (typeof rawResult.startDate === 'string' ? 
        rawResult.startDate : 
        rawResult.startDate.toISOString()) : 
      undefined,
    // ...other properties
  };
}

// Convert an array of results
export function adaptSearchResults(rawResults: RawSearchResult[]): SearchResult[] {
  return rawResults.map(adaptSearchResult);
}
```

### 3. Context Integration

In context providers, we apply the adapter before setting the results:

```typescript
// MainSearchContext.tsx
<MainSearchContext.Provider
  value={{
    // Apply adapter to ensure type compatibility
    results: searchQuery.data ? adaptSearchResults(searchQuery.data) : [],
    // ...other values
  }}
>
  {children}
</MainSearchContext.Provider>
```

## Benefits

1. **Type Safety**: Ensures all search results conform to the expected interface.
2. **Separation of Concerns**: Keeps data transformation logic separate from UI components.
3. **Maintainability**: Makes it easier to accommodate changes in API responses or internal interfaces.
4. **Error Prevention**: Prevents runtime errors from type mismatches or unexpected null values.

## Best Practices

1. **Explicit Type Conversion**: Always explicitly convert types rather than using type assertions.
2. **Default Values**: Provide sensible defaults for missing properties.
3. **Date Normalization**: Convert all dates to ISO strings for consistency.
4. **Defensive Programming**: Handle potential null or undefined values safely.

## Example Usage

```typescript
// In a component
const { results } = useSearchContext();

// 'results' is now guaranteed to be SearchResult[] with correct types
// This prevents TypeScript errors and runtime issues
results.forEach(result => {
  // Safe access to properties
  const title = result.title;
  const startDate = result.startDate; // Will be string or undefined, never null
});
```

## Related Type Definitions

For complete type definitions, refer to:
- `src/server/services/search/types.ts` - Core search type definitions
- `src/utils/search/searchResultAdapter.ts` - Adapter implementation