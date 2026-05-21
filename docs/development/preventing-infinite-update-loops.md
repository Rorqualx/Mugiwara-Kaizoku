# Preventing Infinite Update Loops

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Preventing Infinite Update Loops

---
# Preventing Infinite Update Loops in React Components

This guide provides comprehensive information on preventing infinite update loops in React components, with a specific focus on applications using Zustand for state management.

## Understanding the Problem

Infinite update loops occur when a component continuously re-renders itself in an endless cycle. This typically happens when:

1. A state update in the render phase triggers another render
2. A component's render output depends on a value that changes on every render
3. A hook returns a new reference on every call, causing React to think the value has changed

In applications using Zustand with React's `useSyncExternalStore` hook (which Zustand uses internally), a common cause is improper memoization of selector results.

## Common Warning Signs

Watch for these warning signs that may indicate an infinite update loop:

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
```

```
Uncaught Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

## Root Causes in Zustand Applications

### 1. Creating New Objects in Selectors

```typescript
// ❌ BAD: Creates a new object on every render
const filters = useUIStore((state) => {
  return {
    searchTerm: state.filters.searchTerm || '',
    sources: state.filters.sources || []
  };
});
```

### 2. Circular Dependencies

```typescript
// ❌ BAD: Circular dependency between selectedItems and currentCategory
const selectedItems = useMemo(() => {
  return items.filter(item => item.category === currentCategory.id);
}, [items, currentCategory]);

const currentCategory = useMemo(() => {
  return categories.find(cat => cat.items.some(item => selectedItems.includes(item)));
}, [categories, selectedItems]); // Circular dependency!
```

### 3. Direct Destructuring of Selector Results

```typescript
// ❌ BAD: Direct destructuring breaks reference equality
const { value1, value2 } = useStoreSelectors();
```

### 4. Inefficient Comparison Logic

```typescript
// ❌ BAD: Inefficient comparison using string concatenation
const currentIds = items.map(i => i.id).sort().join(',');
const prevIds = prevItems.map(i => i.id).sort().join(',');
if (currentIds !== prevIds) {
  // Update logic
}
```

## Best Practices for Prevention

### 1. Store Selector Results Before Destructuring

```typescript
// ✅ GOOD: Store the result before destructuring
const storeSelectors = useStoreSelectors();
const { value1, value2 } = storeSelectors;
```

Even better, use our utility function:

```typescript
// ✅ BEST: Use the safe selector utility
const storeSelectors = useSafeSelector(useStoreSelectors, 'ComponentName');
const { value1, value2 } = storeSelectors;
```

### 2. Properly Memoize Derived State

```typescript
// ✅ GOOD: Proper memoization with correct dependencies
const filteredItems = useMemo(() => {
  return items.filter(item => item.category === categoryId);
}, [items, categoryId]); // Only depend on primitive values or stable references
```

### 3. Break Circular Dependencies

```typescript
// ✅ GOOD: Break circular dependencies
const selectedItems = useMemo(() => {
  return items.filter(item => item.category === categoryId);
}, [items, categoryId]); // Depend on categoryId (primitive) instead of currentCategory (object)

const currentCategory = useMemo(() => {
  return categories.find(cat => cat.id === categoryId);
}, [categories, categoryId]); // No circular dependency
```

### 4. Use Efficient Comparison Logic

```typescript
// ✅ GOOD: Efficient comparison using Set
const hasChanged = (prev, current) => {
  if (prev.length !== current.length) return true;
  
  const prevSet = new Set(prev.map(item => item.id));
  return current.some(item => !prevSet.has(item.id));
};
```

### 5. Use Stable References

```typescript
// ✅ GOOD: Return the same reference if nothing changed
const getItems = useCallback(() => {
  if (itemsRef.current.length === items.length && !hasChanged(itemsRef.current, items)) {
    return itemsRef.current;
  }
  itemsRef.current = items;
  return items;
}, [items]);
```

## Using the useSafeSelector Utility

We've created a utility function to help prevent infinite update loops:

```typescript
import { useSafeSelector } from '@/utils/storeUtils';

function MyComponent() {
  // Use the safe selector utility
  const storeSelectors = useSafeSelector(useStoreSelectors, 'MyComponent');
  
  // Destructure after storing the reference
  const { someValue, someOtherValue } = storeSelectors;
  
  // Rest of component...
}
```

This utility:
1. Tracks selector result changes across renders
2. Warns if the selector result changes on every render
3. Enforces the pattern of storing selector results before destructuring

## Debugging Infinite Update Loops

If you encounter an infinite update loop:

1. **Identify the component**: Check the error stack trace to find the component causing the issue
2. **Check selector usage**: Ensure selectors are properly memoized and not creating new objects
3. **Look for circular dependencies**: Check for circular dependencies in useMemo hooks
4. **Verify component usage**: Make sure the component is storing selector results before destructuring
5. **Use React DevTools**: Use React DevTools Profiler to identify components that are re-rendering too often
6. **Add console logs**: Add console logs with render counts to identify excessive re-renders

## Utility Functions

Our `storeUtils.ts` file provides several utility functions to help prevent infinite update loops:

### useSafeSelector

```typescript
function useSafeSelector<T extends object>(
  selectorHook: () => T,
  componentName: string
): T
```

Safely use a store selector hook with protection against infinite update loops.

### hasSameElements

```typescript
function hasSameElements<T>(arr1: T[], arr2: T[]): boolean
```

Check if two arrays have the same elements (ignoring order) using Set for efficient comparison.

### shallowEqual

```typescript
function shallowEqual<T extends object>(obj1: T, obj2: T): boolean
```

Shallow compare two objects for equality by checking if they have the same properties with the same values.

## Related Documentation

- [fix-infinite-update-loop.md](./fix-infinite-update-loop.md) - Documentation of a similar issue in the MangaList component
- [fix-infinite-update-loop-in-librarymanager.md](./fix-infinite-update-loop-in-librarymanager.md) - Documentation of the issue in the LibraryManager component
- [fix-infinite-update-loop-in-librarymanager-implementation.md](./fix-infinite-update-loop-in-librarymanager-implementation.md) - Technical details of the fix for the LibraryManager component

## External Resources

- [React useSyncExternalStore Documentation](https://react.dev/reference/react/useSyncExternalStore)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
