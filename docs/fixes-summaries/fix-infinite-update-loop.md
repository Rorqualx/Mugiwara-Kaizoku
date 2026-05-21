# Fix Infinite Update Loop

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Infinite Update Loop

---
# Fixing Infinite Update Loops in React Components

This document provides guidance on identifying and fixing infinite update loops in React components, particularly when using Zustand for state management.

## Common Causes of Infinite Update Loops

1. **Circular Dependencies**: When two or more components or state slices depend on each other's updates, creating a cycle.
2. **Missing Dependency Arrays**: Forgetting to specify dependencies in `useEffect`, `useMemo`, or `useCallback` hooks.
3. **Unstable References**: Creating new object or function references on every render.
4. **Direct Store Access**: Accessing the store directly in event handlers or effects without proper memoization.
5. **Auto-Synchronization**: Automatically synchronizing state between different parts of the application.

## Symptoms

- Console warnings about "Maximum update depth exceeded"
- Components re-rendering infinitely
- Browser becoming unresponsive
- Warning messages about "The result of getSnapshot should be cached"

## Solutions

### 1. Break Circular Dependencies

Identify and break circular dependencies by:
- Using refs to track values without triggering re-renders
- Separating state updates into different components
- Implementing one-way data flow

Example:
```typescript
// Before: Circular dependency
const currentLibrary = useSelector(state => state.libraries.find(l => l.id === state.selectedLibraryId));
useEffect(() => {
  if (currentLibrary) {
    setTargetLibraryId(currentLibrary.id);
  }
}, [currentLibrary]);

// After: Breaking the circular dependency with a ref
const selectedLibraryIdRef = useRef(null);
if (selectedLibraryIdRef.current !== state.selectedLibraryId) {
  selectedLibraryIdRef.current = state.selectedLibraryId;
}
const currentLibrary = useSelector(state => 
  state.libraries.find(l => l.id === selectedLibraryIdRef.current)
);
```

### 2. Implement Manual Synchronization

Replace automatic synchronization with manual, user-triggered synchronization:

```typescript
// Before: Automatic synchronization
useEffect(() => {
  if (selectedLibraryId !== targetLibraryId) {
    setTargetLibraryId(selectedLibraryId);
  }
}, [selectedLibraryId, targetLibraryId]);

// After: Manual synchronization with a button
const handleSyncLibrary = useCallback(() => {
  setTargetLibraryId(selectedLibraryId);
}, [selectedLibraryId, setTargetLibraryId]);

// In the JSX:
<Button onClick={handleSyncLibrary}>Sync Library</Button>
```

### 3. Use Proper Memoization

Ensure proper memoization of derived values and callbacks:

```typescript
// Before: Creating new references on every render
const handleClick = () => {
  console.log('Clicked!');
};

// After: Proper memoization
const handleClick = useCallback(() => {
  console.log('Clicked!');
}, []);
```

### 4. Implement Equality Checks

Add equality checks before updating state:

```typescript
// Before: Updating state without checking
setTargetLibraryId: (id) => set(state => {
  state.targetLibraryId = id;
}),

// After: Checking if the value has changed
setTargetLibraryId: (id) => set(state => {
  if (state.targetLibraryId !== id) {
    state.targetLibraryId = id;
  }
}),
```

### 5. Use Refs for Tracking State

Use refs to track state changes without triggering re-renders:

```typescript
// Before: Directly accessing store in event handlers
const handleChange = (e) => {
  const value = e.target.value;
  const currentValue = useStore.getState().value;
  if (value !== currentValue) {
    useStore.getState().setValue(value);
  }
};

// After: Using a ref to track state
const currentValueRef = useRef(null);
useEffect(() => {
  currentValueRef.current = useStore.getState().value;
  const unsubscribe = useStore.subscribe(
    state => { currentValueRef.current = state.value; }
  );
  return unsubscribe;
}, []);

const handleChange = (e) => {
  const value = e.target.value;
  if (value !== currentValueRef.current) {
    useStore.getState().setValue(value);
  }
};
```

## Debugging Tools

1. **React DevTools**: Use the React DevTools profiler to identify components that are re-rendering too frequently.
2. **Console Logging**: Add strategic console logs to track component renders and state updates.
3. **useSafeSelector**: Use a custom hook to detect and warn about potential infinite loops:

```typescript
export function useSafeSelector<T extends object>(
  selectorHook: () => T,
  componentName: string
): T {
  const renderCountRef = useRef(0);
  const prevResultRef = useRef<T | null>(null);
  const memoizedResultRef = useRef<T | null>(null);
  
  const rawResult = selectorHook();
  renderCountRef.current += 1;
  
  const resultChanged = prevResultRef.current !== rawResult;
  prevResultRef.current = rawResult;
  
  if (
    resultChanged && 
    renderCountRef.current > 5 && 
    !warningShownRef.current
  ) {
    console.error(
      `Potential infinite update loop detected in ${componentName}`
    );
    return memoizedResultRef.current || rawResult;
  }
  
  if (!resultChanged || renderCountRef.current < 3) {
    memoizedResultRef.current = rawResult;
  }
  
  return memoizedResultRef.current || rawResult;
}
```

## Best Practices

1. **One-Way Data Flow**: Implement one-way data flow to prevent circular dependencies.
2. **Explicit Updates**: Prefer explicit, user-triggered updates over automatic synchronization.
3. **Stable References**: Ensure stable references for objects and functions.
4. **Throttling**: Use throttling or debouncing for frequent updates.
5. **Immutable Updates**: Use immutable update patterns to ensure proper change detection.
6. **Component Isolation**: Isolate components to minimize dependencies between them.
7. **Defensive Programming**: Implement safeguards to break infinite loops when they occur.

## Related Documentation

- [fix-infinite-update-loop-in-librarymanager.md](./fix-infinite-update-loop-in-librarymanager.md) - Case study of fixing an infinite update loop in the LibraryManager component
- [fix-infinite-update-loop-in-librarymanager-implementation.md](./fix-infinite-update-loop-in-librarymanager-implementation.md) - Detailed implementation of the LibraryManager fix
- [React Hooks Rules](https://reactjs.org/docs/hooks-rules.html) - Official React documentation on Rules of Hooks
