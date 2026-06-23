# TypeScript Fix Patterns Quick Reference

This document provides a quick reference for the most important TypeScript patterns established during the 80-phase TypeScript improvement project.

## 1. AsyncResult Pattern

```typescript
// Always use AsyncResult for async operations
const [state, setState] = useState<AsyncResult<Data, Error>>(createIdleResult());

// Handle all states explicitly
return handleAsyncResult(state, {
  idle: () => <div>Ready to load</div>,
  loading: () => <Spinner />,
  error: (error) => <ErrorMessage error={error.message} />,
  success: (data) => <DataDisplay data={data} />
});
```

## 2. Type-Safe Event Handlers

```typescript
// Always type event handlers explicitly
const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
  setValue(e.target.value);
};

const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
  e.preventDefault();
  // Handle form submission
};
```

## 3. Array Type Guards

```typescript
// Always check arrays before mapping
function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}

// Safe array rendering
if (!items || !Array.isArray(items)) {
  return null;
}
return items.map(item => <Item key={item.id} {...item} />);
```

## 4. ID Type Conversion

```typescript
// Use ID type for flexibility
type ID = string | number;

// Always use conversion utilities
const numId = toNumberId(id);
const strId = toStringId(id);
const same = areIdsEqual(id1, id2);
```

## 5. Component Props Pattern

```typescript
interface ComponentProps {
  // Required props
  id: string;
  title: string;
  
  // Optional props with ?
  description?: string;
  
  // Event handlers are optional
  onClick?: (id: string) => void;
  
  // Children explicitly typed
  children?: React.ReactNode;
}
```

## 6. Hook Return Types

```typescript
interface UseHookResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Always return consistent shape
function useCustomHook<T>(id: string): UseHookResult<T> {
  // Implementation
}
```

## 7. Import Paths

```typescript
// ❌ Avoid relative paths
import { utils } from '../../../utils';

// ✅ Use @/ alias imports
import { utils } from '@/utils';
```

## 8. Error Handling

```typescript
// Always handle non-Error throws
catch (error) {
  return createErrorResult(
    error instanceof Error 
      ? error 
      : new Error(String(error))
  );
}
```

## 9. Type Guards for External Data

```typescript
// Always validate external data
function isValidApiResponse(data: unknown): data is ApiResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    'result' in data
  );
}
```

## 10. Form State Management

```typescript
// Type form state explicitly
interface FormState {
  title: string;
  description: string;
  isValid: boolean;
}

// Initialize with proper defaults
const [formState, setFormState] = useState<FormState>({
  title: '',
  description: '',
  isValid: false
});
```

## Common Fixes Applied

1. **Import Issues**: Changed `import type` to `import` when using as values
2. **Array Validation**: Used `isArrayOf` instead of `isArray` with predicates
3. **ID Compatibility**: Changed `mangaId: number` to `mangaId: ID`
4. **Logging**: Used string templates instead of object parameters
5. **Type Assertions**: Avoided `as` casts, used type guards instead
6. **Optional Chaining**: Used `?.` for safe property access
7. **Nullish Coalescing**: Used `??` for default values
8. **Enum Usage**: Imported enums properly for use as values
9. **Generic Constraints**: Added proper constraints to generic types
10. **Discriminated Unions**: Used for complex state management

## Remember

- Always check for `null` and `undefined`
- Use type guards instead of type assertions
- Handle all AsyncResult states
- Type event handlers explicitly
- Validate external data before use
- Use `@/` alias imports (never relative paths)
- Provide meaningful error messages
- Initialize state with proper types
- Document complex types with JSDoc
- Test type safety with `bun run type-check`