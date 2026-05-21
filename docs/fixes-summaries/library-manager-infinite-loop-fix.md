# Library Manager Infinite Loop Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Library Manager Infinite Loop Fix

---
# Library Manager Infinite Update Loop Fix

This document explains the issue with the infinite update loop in the Library Manager component and provides guidance on how to properly fix it in the future.

## Problem Description

The SimpleLibraryManager component was experiencing an infinite update loop, resulting in the following error:

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

The error was occurring in the React hooks related to store updates, specifically:

```
at forceStoreRerender (webpack-internal:///(pages-dir-browser)/./node_modules/react-dom/cjs/react-dom.development.js:16977:5)
at updateStoreInstance (webpack-internal:///(pages-dir-browser)/./node_modules/react-dom/cjs/react-dom.development.js:16943:5)
at commitHookEffectListMount (webpack-internal:///(pages-dir-browser)/./node_modules/react-dom/cjs/react-dom.development.js:23145:26)
```

## Root Causes

After multiple attempts to fix the issue, we identified several potential root causes:

1. **Circular Dependencies**: The component had circular dependencies between state updates, especially with how `selectedLibraryId` and `targetLibraryId` interact.

2. **Inefficient Store Access**: The component was using complex selectors that created new object references on each render.

3. **Automatic Synchronization**: The component had useEffect hooks that automatically updated store state in response to local state changes, creating a circular update pattern.

4. **Complex State Management**: The component was using a combination of local state and store state with complex interactions between them.

## Temporary Solution

As a temporary solution, we've replaced the SimpleLibraryManager component with a static placeholder that doesn't use any store state at all. This breaks the infinite update loop by eliminating all store interactions that could cause circular dependencies.

## Recommended Approach for a Permanent Fix

To properly fix this issue in the future, we recommend the following approach:

1. **Complete Separation of Local and Store State**:
   - Use local component state for UI elements only
   - Only update store state in explicit user actions (button clicks)
   - Avoid automatic synchronization between states

2. **Minimal Store Access**:
   - Use individual selectors for each piece of state
   - Avoid complex selectors that create new object references
   - Use the useSafeSelector utility for complex selectors

3. **No useEffect Hooks That Update Store State**:
   - Don't use useEffect hooks to update store state
   - Only update store state in explicit user actions

4. **Proper Memoization**:
   - Use useCallback for all event handlers
   - Use useMemo for derived values
   - Ensure proper dependency arrays

5. **Stable References**:
   - Store selector results before destructuring
   - Use refs to track previous values
   - Use proper equality checks

## Example Implementation

Here's a simplified example of how to properly implement the SimpleLibraryManager component:

```typescript
function SimpleLibraryManager() {
  // Local component state only
  const [scanPathInput, setScanPathInput] = useState('');
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  
  // Get minimal required state from the store
  const libraries = useLibraryStore(state => state.libraries);
  
  // Get actions separately
  const setTargetLibraryId = useLibraryStore(state => state.setTargetLibraryId);
  const setScanPath = useLibraryStore(state => state.setScanPath);
  
  // Handle sync button click - explicitly update store state
  const handleSyncLibrary = useCallback(() => {
    if (selectedLibraryId !== null) {
      // Update store state in explicit user action
      setTargetLibraryId(selectedLibraryId);
      
      if (scanPathInput) {
        setScanPath(scanPathInput);
      }
    }
  }, [selectedLibraryId, scanPathInput, setTargetLibraryId, setScanPath]);
  
  // Rest of component...
}
```

## Testing and Verification

To verify that the fix works:

1. Navigate to the Media Management settings page
2. Check that the Library Manager component renders without errors
3. Verify that no infinite update loop occurs
4. Check the console for any error messages

## Related Documentation

- [fix-infinite-update-loop.md](./fix-infinite-update-loop.md) - General guidance on fixing infinite update loops
- [preventing-infinite-update-loops.md](./preventing-infinite-update-loops.md) - Best practices for preventing infinite update loops
- [fix-infinite-update-loop-in-librarymanager-implementation.md](./fix-infinite-update-loop-in-librarymanager-implementation.md) - Previous attempt to fix the issue
