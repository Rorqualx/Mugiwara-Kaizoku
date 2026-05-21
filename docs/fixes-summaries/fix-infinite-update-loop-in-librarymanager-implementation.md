# Fix Infinite Update Loop In Librarymanager Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Infinite Update Loop In Librarymanager Implementation

---
# Fixing Infinite Update Loops in LibraryManager Component

This document details the implementation of the fix for the infinite update loop issue in the LibraryManager component.

## Problem Description

The LibraryManager component was experiencing an infinite update loop, resulting in the following error:

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

The root cause was a circular dependency between state updates:

1. The component was using complex selectors from `useStoreSelectors` that created new object references on each render
2. Auto-synchronization between `selectedLibraryId` and `targetLibraryId` in the store was causing cascading updates
3. Direct store access in event handlers was triggering additional re-renders

## Solution Approach

We implemented a radical solution with three main components:

1. **Simplified Component Architecture**
   - Created a new `SimpleLibraryManager` component with minimal dependencies
   - Used local component state where possible instead of complex global state
   - Implemented explicit user actions for all state changes

2. **Error Boundary Protection**
   - Created a `SafeLibraryManager` wrapper component with error boundaries
   - Added automatic recovery mechanisms
   - Implemented forced remounting to break potential infinite loops

3. **Store Access Optimization**
   - Consolidated store access into a single hook call
   - Used proper memoization for derived values
   - Eliminated circular dependencies between state updates

## Implementation Details

### 1. SimpleLibraryManager Component

The `SimpleLibraryManager` component is a stripped-down version of the original `LibraryManager` component:

```typescript
export function SimpleLibraryManager() {
  // Local component state
  const [manualPath, setManualPath] = useState(false);
  const [scanPathInput, setScanPathInput] = useState('');
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  
  // Direct store access with minimal selectors - use a single hook call
  const {
    libraries,
    scanning,
    scanProgress,
    setScanningStatus, 
    updateScanProgress,
    setScanPath,
    setTargetLibraryId
  } = useLibraryStore(state => ({
    // State
    libraries: state.libraries,
    scanning: state.scanning,
    scanProgress: state.scanProgress,
    
    // Actions
    setScanningStatus: state.setScanningStatus,
    updateScanProgress: state.updateScanProgress,
    setScanPath: state.setScanPath,
    setTargetLibraryId: state.setTargetLibraryId
  }));
  
  // Find the current library based on local state
  const currentLibrary = libraries.find(lib => lib.id === selectedLibraryId) || null;
  
  // Manual sync button handler
  const handleSyncLibrary = useCallback(() => {
    if (selectedLibraryId !== null) {
      console.log('SimpleLibraryManager: Setting target library ID to', selectedLibraryId);
      setTargetLibraryId(selectedLibraryId);
    }
  }, [selectedLibraryId, setTargetLibraryId]);
  
  // ... other handlers and UI rendering
}
```

Key improvements:
- Uses local component state for UI elements
- Consolidates store access into a single hook call
- Implements explicit user actions for state changes
- Avoids complex selectors and memoization

### 2. SafeLibraryManager Component

The `SafeLibraryManager` component wraps the `SimpleLibraryManager` with error boundaries:

```typescript
export function SafeLibraryManager() {
  // Use state to force remount if needed
  const [key, setKey] = useState(0);

  // Reset component if it's been mounted for too long
  useEffect(() => {
    const timer = setTimeout(() => {
      // Force remount after 5 minutes to prevent memory leaks
      setKey(prev => prev + 1);
    }, 5 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [key]);

  return (
    <LibraryManagerErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <SimpleLibraryManager key={key} />
      </Suspense>
    </LibraryManagerErrorBoundary>
  );
}
```

Key features:
- Custom error boundary to catch and handle errors
- Suspense boundary for async loading
- Automatic remounting to break potential infinite loops
- Fallback UI for error states

### 3. Store Provider Modifications

We removed the auto-sync subscription in `StoreProvider.tsx`:

```typescript
/**
 * Auto-sync has been completely disabled to prevent infinite update loops
 * 
 * The previous implementation used a subscription to library store changes
 * to automatically sync selectedLibraryId with targetLibraryId, but this
 * caused circular dependencies and infinite update loops.
 * 
 * Instead, we now rely on explicit user actions to update the target library.
 * This is a more predictable and stable approach.
 * 
 * @see LibraryManager component for the manual sync implementation
 */
```

## Usage in Media Management Page

The `MediaManagementSettings` component now uses the `SafeLibraryManager`:

```typescript
export default function MediaManagementSettings() {
  return (
    <SettingsLayout title="Media Management">
      <Stack>
        <DownloadSettings />
        <Title order={3} mb="sm">Library Management</Title>
        <SafeLibraryManager />
      </Stack>
    </SettingsLayout>
  );
}
```

## Testing and Verification

To verify the fix:
1. Navigate to the Media Management settings page
2. Select a library from the dropdown
3. Click the "Set Target Library" button
4. Verify that no infinite update loop occurs
5. Check the console for any error messages

## Lessons Learned

1. **Avoid Circular Dependencies**: State updates that depend on each other can easily create infinite loops.
2. **Use Local State**: Prefer local component state for UI elements that don't need to be shared.
3. **Explicit User Actions**: Use explicit user actions for state changes instead of automatic synchronization.
4. **Error Boundaries**: Always wrap complex components with error boundaries to prevent cascading failures.
5. **Simplified Architecture**: When facing complex issues, sometimes it's better to start from scratch with a simpler approach.

## Related Documentation

- [fix-infinite-update-loop.md](./fix-infinite-update-loop.md) - General guidance on fixing infinite update loops
- [preventing-infinite-update-loops.md](./preventing-infinite-update-loops.md) - Best practices for preventing infinite update loops
