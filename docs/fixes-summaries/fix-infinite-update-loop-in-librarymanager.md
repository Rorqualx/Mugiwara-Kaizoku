# Fix Infinite Update Loop In Librarymanager

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Infinite Update Loop In Librarymanager

---
# Fixing Infinite Update Loop in LibraryManager Component

## Issue Description

The LibraryManager component was experiencing an infinite update loop with the following error:

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop Error Component Stack
    at LibraryManager (LibraryManager.tsx:59:47)
```

This was followed by:

```
Uncaught Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

## Root Cause

The issue was caused by improper memoization in the `useStoreSelectors` hook, specifically:

1. Circular dependencies between `selectedLibraryManga` and `currentLibrary` calculations
2. Inefficient comparison logic that created new objects on each render
3. Destructuring the selector results directly in the component, which broke reference equality

## Solution Implemented

The solution involved several changes:

### 1. In `useStoreSelectors.ts`:

- Improved the memoization of the `selectedLibraryManga` array:
  - Used more efficient comparison logic
  - Implemented a Set-based approach for faster ID comparison
  - Fixed conditional returns to maintain stable references

- Fixed the `currentLibrary` memoization:
  - Simplified the key generation for stable references
  - Broke the circular dependency with `selectedLibraryManga`
  - Added proper reference equality checks

- Enhanced the final selector result memoization:
  - Implemented property-by-property comparison
  - Used a more efficient approach to detect changes
  - Ensured stable references for unchanged properties

### 2. In `LibraryManager.tsx`:

- Stored the result of `useStoreSelectors()` in a variable before destructuring:
  ```typescript
  const storeSelectors = useStoreSelectors();
  const { 
    scanProgress, 
    scanning, 
    currentLibrary,
    libraries 
  } = storeSelectors;
  ```
  This maintains a stable reference to the selector result, preventing unnecessary re-renders.

## Best Practices for Zustand Selectors

To avoid similar issues in the future:

1. **Store selector results before destructuring**: Always store the result of selector hooks in a variable before destructuring to maintain reference equality.

2. **Break circular dependencies**: Ensure that memoized values don't create circular dependencies in their dependency arrays.

3. **Use efficient comparison logic**: When comparing arrays or objects, use efficient algorithms (like Sets for IDs) rather than string concatenation.

4. **Minimize dependency arrays**: Only include the specific values needed in dependency arrays, not entire state objects.

5. **Use stable references**: Ensure that references remain stable when values haven't changed by using proper equality checks.

6. **Cache intermediate results**: Use refs to store previous values for comparison and reuse when possible.

7. **Implement proper memoization**: Use `useMemo` with correct dependency arrays to prevent unnecessary recalculations.

## Related Files

- `src/components/library/LibraryManager.tsx` - The component that was experiencing the infinite loop
- `src/store/useStoreSelectors.ts` - The selector hook that was modified to fix the issue
- `docs/fix-infinite-update-loop.md` - Documentation of a similar issue in the MangaList component
