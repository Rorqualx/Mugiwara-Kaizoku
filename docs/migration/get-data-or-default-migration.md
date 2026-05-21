# Get Data Or Default Migration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Get Data Or Default Migration

---
# Migrating from getDataOrDefault to unwrapOr

As part of our effort to standardize AsyncResult handling across the codebase, we are replacing the deprecated `getDataOrDefault` function with the more semantically named `unwrapOr` function.

## Overview

The `getDataOrDefault` function has been deprecated and is now implemented as an alias for `unwrapOr`. All new code should use `unwrapOr` directly.

## Migration Guide

### Simple Replacement

In most cases, you can simply replace `getDataOrDefault` with `unwrapOr`:

```typescript
// Before
import { getDataOrDefault } from '../utils/async-result';
const data = getDataOrDefault(result, defaultValue);

// After
import { unwrapOr } from '../utils/async-result';
const data = unwrapOr(result, defaultValue);
```

### Importing from async-result-helpers

If you were importing `getDataOrDefault` from `async-result-helpers.ts`, change the import to get `unwrapOr` directly from `async-result.ts`:

```typescript
// Before
import { getDataOrDefault } from '../utils/async-result-helpers';
const data = getDataOrDefault(result, defaultValue);

// After
import { unwrapOr } from '../utils/async-result';
const data = unwrapOr(result, defaultValue);
```

### Inline Replacement

If you were using `getDataOrDefault` inline, replace it with `unwrapOr`:

```typescript
// Before
return isSuccess(result) ? result.data : defaultValue;
// or
return getDataOrDefault(result, defaultValue);

// After
return unwrapOr(result, defaultValue);
```

## Benefits of unwrapOr

The `unwrapOr` function offers several benefits:

1. **Semantic clarity**: The name clearly indicates that it "unwraps" a value from a container type or returns a default.
2. **Consistency**: This naming convention is more aligned with other functional programming libraries.
3. **Type safety**: Like `getDataOrDefault`, it maintains proper typing for both the result data and default value.

## Example

```typescript
import { AsyncResult, unwrapOr, isSuccess, isError } from '../utils/async-result';

function processUserData(result: AsyncResult<UserData, Error>): string {
  // Use unwrapOr to get data with a default empty object
  const userData = unwrapOr(result, { name: 'Unknown', age: 0 });
  
  // Now work with userData safely
  return `User: ${userData.name}, Age: ${userData.age}`;
}
```

## Transition Period

During the transition period, `getDataOrDefault` will continue to work as it now delegates to `unwrapOr`. However, it will be removed in a future update, so all new code should use `unwrapOr` directly.