# TypeScript Error Analysis - October 7, 2025

**Status**: 22 Type Errors Across 4 Files
**Priority**: High - Blocking strict type compliance
**Related**: Technical Debt Resolution Week 2-3

---

## 📊 Error Summary

| Error Code | Count | Description | Severity |
|------------|-------|-------------|----------|
| TS2339 | 12 | Property 'error' does not exist on type 'never' | High |
| TS4111 | 4 | Property from index signature requires bracket notation | Medium |
| TS2412 | 2 | exactOptionalPropertyTypes incompatibility | Medium |
| TS2322 | 2 | Type '{}' not assignable to 'string' | Medium |
| TS2375 | 1 | exactOptionalPropertyTypes incompatibility | Medium |
| TS2345 | 1 | 'string \| undefined' not assignable to 'string' | Medium |
| **Total** | **22** | | |

---

## 🔍 Detailed Analysis by File

### 1. `src/store/RootStoreProvider.tsx` - 12 Errors (TS2339)

**Error Pattern**: Property 'error' does not exist on type 'never'

**Affected Lines**: 164, 165, 218, 219, 282, 283 (duplicated pattern)

**Root Cause**:
TypeScript's type narrowing doesn't work correctly with tRPC query objects when checking `isError` first. The type system infers `query.error` as `never` even inside an `if (query.isError)` block.

**Current Code**:
```typescript
// Line 164-167
if (settingsQuery.isError) {
  const errorMsg = settingsQuery.error && typeof settingsQuery.error === 'object' && 'message' in settingsQuery.error
    ? String(settingsQuery.error.message)  // ❌ error.message doesn't exist on type 'never'
    : 'Query error';
  throw new Error(`Failed to load settings: ${errorMsg}`);
}
```

**Pattern Repeats For**:
- `settingsQuery` (lines 164-165)
- `libraryQuery` (lines 218-219)
- `mangaQuery` (lines 282-283)

**Solution**:
```typescript
// Option 1: Use optional chaining and nullish coalescing
if (settingsQuery.isError) {
  const errorMsg = (settingsQuery.error as Error)?.message ?? 'Query error';
  throw new Error(`Failed to load settings: ${errorMsg}`);
}

// Option 2: Type assertion with proper check
if (settingsQuery.isError) {
  const error = settingsQuery.error as unknown;
  const errorMsg = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : 'Query error';
  throw new Error(`Failed to load settings: ${errorMsg}`);
}

// Option 3: Helper function (recommended for DRY)
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

if (settingsQuery.isError) {
  const errorMsg = extractErrorMessage(settingsQuery.error);
  throw new Error(`Failed to load settings: ${errorMsg}`);
}
```

**Files Needed**:
- `src/store/RootStoreProvider.tsx:164-167` (settingsQuery #1)
- `src/store/RootStoreProvider.tsx:218-221` (libraryQuery)
- `src/store/RootStoreProvider.tsx:282-285` (mangaQuery)

---

### 2. `src/contexts/ProwlarrContext.tsx` - 6 Errors (TS4111 + TS2322)

#### Error Type A: TS4111 (4 errors) - Index Signature Property Access

**Affected Lines**: 111, 112, 157 (2 instances)

**Root Cause**:
`settings` object has an index signature type, requiring bracket notation for property access.

**Current Code**:
```typescript
// Line 111-112
const config = apiConfig || {
  baseURL: settings?.prowlarrBaseURL || '',  // ❌ TS4111
  apiKey: settings?.prowlarrApiKey || ''     // ❌ TS4111
};

// Line 157
}, [apiConfig, settings?.prowlarrBaseURL, settings?.prowlarrApiKey, updateFromClientStatus]);
// ❌ TS4111 x2
```

**Solution**:
```typescript
// Fix: Use bracket notation
const config = apiConfig || {
  baseURL: settings?.['prowlarrBaseURL'] || '',
  apiKey: settings?.['prowlarrApiKey'] || ''
};

// Dependency array
}, [apiConfig, settings?.['prowlarrBaseURL'], settings?.['prowlarrApiKey'], updateFromClientStatus]);
```

#### Error Type B: TS2322 (2 errors) - Type Mismatch

**Affected Lines**: 129, 130

**Root Cause**:
Function expects specific string type, but receiving `string` union that could be empty string from default `|| ''`.

**Current Code**:
```typescript
// Line 128-132
clientRef.current = createProwlarrClient({
  baseURL: config.baseURL,  // ❌ Type '{}' is not assignable to type 'string'
  apiKey: config.apiKey,    // ❌ Type '{}' is not assignable to type 'string'
  notifyOnError: true
});
```

**Solution**:
```typescript
// Option 1: Type assertion (if we know it's safe)
clientRef.current = createProwlarrClient({
  baseURL: config.baseURL as string,
  apiKey: config.apiKey as string,
  notifyOnError: true
});

// Option 2: More strict check (recommended)
if (config.baseURL && config.apiKey && config.baseURL !== '' && config.apiKey !== '') {
  clientRef.current = createProwlarrClient({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    notifyOnError: true
  });
}

// Option 3: Update interface to accept empty string
// In createProwlarrClient definition:
interface ProwlarrClientConfig {
  baseURL: string;  // Allow empty string
  apiKey: string;   // Allow empty string
  notifyOnError?: boolean;
}
```

---

### 3. `src/hooks/useLibrary.ts` - 1 Error (TS2375)

**Affected Line**: 211

**Root Cause**:
`exactOptionalPropertyTypes` strictness - return type declares `library: Library` but actual type is `Library | undefined`.

**Current Code**:
```typescript
// Line 211-223
return {
  libraries: safeLibraries,
  isLoading: libraryQuery.isLoading || libraryDetailQuery.isLoading || false,
  isError: libraryQuery.isError || libraryDetailQuery.isError || false,
  error: /* ... */,
  createLibrary,
  refetchLibraries,
  library: library as Library | undefined,  // ❌ Doesn't match interface
  manga: libraryManga,
  refreshLibrary
};
```

**Solution**:
```typescript
// Check the UseLibraryResult interface definition and update it:
interface UseLibraryResult {
  libraries: Library[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  createLibrary: (path: string) => Promise<Library>;
  refetchLibraries: () => Promise<LibraryDataResponse>;
  library: Library | undefined;  // ✅ Add undefined to the type
  manga: Manga[];
  refreshLibrary: () => Promise<void>;
}
```

---

### 4. `src/server/trpc/routers/manga.ts` - 3 Errors (TS2412 + TS2345)

#### Error Type A: TS2412 (2 errors) - exactOptionalPropertyTypes

**Affected Lines**: 426, 428

**Root Cause**:
`exactOptionalPropertyTypes` requires explicit undefined instead of ternary with undefined.

**Current Code**:
```typescript
// Line 426
providerMetadata: input.providerMetadata !== undefined ? input.providerMetadata : undefined,
// ❌ Type not assignable with exactOptionalPropertyTypes

// Line 428
rawProviderData: input.rawProviderData !== undefined ? input.rawProviderData : undefined
// ❌ Type not assignable with exactOptionalPropertyTypes
```

**Solution**:
```typescript
// Option 1: Use ?? instead of ternary
providerMetadata: input.providerMetadata ?? undefined,
rawProviderData: input.rawProviderData ?? undefined

// Option 2: Conditional assignment (recommended)
...(input.providerMetadata !== undefined && { providerMetadata: input.providerMetadata }),
...(input.rawProviderData !== undefined && { rawProviderData: input.rawProviderData })

// Option 3: Just assign directly if undefined is acceptable
providerMetadata: input.providerMetadata,
rawProviderData: input.rawProviderData
```

#### Error Type B: TS2345 (1 error) - undefined not assignable

**Affected Line**: 1859

**Current Code**:
```typescript
// Line 1859
someFunction(stringOrUndefinedValue)  // ❌ Argument type 'string | undefined' not assignable to 'string'
```

**Solution**:
```typescript
// Option 1: Nullish coalescing with default
someFunction(stringOrUndefinedValue ?? '')

// Option 2: Type guard
if (stringOrUndefinedValue !== undefined) {
  someFunction(stringOrUndefinedValue)
}

// Option 3: Non-null assertion (use sparingly)
someFunction(stringOrUndefinedValue!)
```

---

## 🎯 Recommended Fix Order

### Priority 1 - High Impact (12 errors)
**File**: `src/store/RootStoreProvider.tsx`
- Create `extractErrorMessage` helper function
- Apply to all 3 query error checks (settingsQuery, libraryQuery, mangaQuery)
- **Impact**: Fixes 12/22 errors (54%)

### Priority 2 - Medium Impact (6 errors)
**File**: `src/contexts/ProwlarrContext.tsx`
- Fix index signature access with bracket notation (4 errors)
- Fix type mismatch in createProwlarrClient call (2 errors)
- **Impact**: Fixes 6/22 errors (27%)

### Priority 3 - Low Impact (3 errors)
**File**: `src/server/trpc/routers/manga.ts`
- Fix exactOptionalPropertyTypes issues (2 errors)
- Fix undefined argument (1 error)
- **Impact**: Fixes 3/22 errors (14%)

### Priority 4 - Low Impact (1 error)
**File**: `src/hooks/useLibrary.ts`
- Update UseLibraryResult interface
- **Impact**: Fixes 1/22 errors (5%)

---

## 📝 Implementation Plan

### Step 1: Create Helper Functions
**Location**: `src/utils/error-helpers.ts` (new file)

```typescript
/**
 * Extract error message from unknown error type
 * Handles Error objects, objects with message property, and unknowns
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    return typeof msg === 'string' ? msg : String(msg);
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

/**
 * Extract error message from tRPC query error (handles 'never' type issue)
 */
export function extractTRPCErrorMessage(error: unknown, fallback = 'Query error'): string {
  try {
    return extractErrorMessage(error);
  } catch {
    return fallback;
  }
}
```

### Step 2: Apply Fixes File by File

#### RootStoreProvider.tsx
```typescript
import { extractTRPCErrorMessage } from '@/utils/error-helpers';

// Replace all error extraction patterns with:
if (settingsQuery.isError) {
  const errorMsg = extractTRPCErrorMessage(settingsQuery.error, 'Failed to load settings');
  throw new Error(`Settings query error: ${errorMsg}`);
}
```

#### ProwlarrContext.tsx
```typescript
// Use bracket notation
const config = apiConfig || {
  baseURL: settings?.['prowlarrBaseURL'] || '',
  apiKey: settings?.['prowlarrApiKey'] || ''
};

// Add type safety check
if (config.baseURL && config.apiKey &&
    typeof config.baseURL === 'string' &&
    typeof config.apiKey === 'string') {
  clientRef.current = createProwlarrClient({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    notifyOnError: true
  });
}
```

#### manga.ts router
```typescript
// Use spread operator for optional fields
{
  // ... other fields
  ...(input.providerMetadata !== undefined && {
    providerMetadata: input.providerMetadata
  }),
  ...(input.rawProviderData !== undefined && {
    rawProviderData: input.rawProviderData
  })
}
```

#### useLibrary.ts
Update interface definition to explicitly allow undefined.

---

## ✅ Validation Steps

After implementing fixes:

1. **Run type check**: `pnpm type-check`
2. **Run linter**: `pnpm lint`
3. **Run tests**: `pnpm test`
4. **Build check**: `pnpm build:clean`

Expected outcome: **0 type errors**

---

## 📚 Related Documentation

- [CLAUDE.md](/docs/ui-ux/CLAUDE.md) - Coding rules and type safety guidelines
- [Type System Architecture](/docs/typescript/type-system-architecture-standardization.md)
- [TypeScript Patterns Guide](/docs/typescript/typescript-patterns-guide.md)
- [Technical Debt Progress](/docs/technical-debt/PROGRESS_UPDATE.md)

---

## 🔄 Pattern Prevention

These errors highlight common patterns to avoid:

### ❌ Anti-Pattern 1: Complex error type checks
```typescript
// Don't do this - type narrowing fails
if (query.isError) {
  const msg = query.error && typeof query.error === 'object' && 'message' in query.error
    ? String(query.error.message)
    : 'Error';
}
```

### ✅ Best Practice: Helper functions
```typescript
// Do this - clean and type-safe
if (query.isError) {
  const msg = extractTRPCErrorMessage(query.error);
}
```

### ❌ Anti-Pattern 2: Index signature without bracket notation
```typescript
// Don't do this with index signatures
const value = settings?.propertyName;
```

### ✅ Best Practice: Use bracket notation
```typescript
// Do this for index signatures
const value = settings?.['propertyName'];
```

### ❌ Anti-Pattern 3: Ternary with undefined when exactOptionalPropertyTypes is enabled
```typescript
// Don't do this
field: input.field !== undefined ? input.field : undefined
```

### ✅ Best Practice: Use spread operator or nullish coalescing
```typescript
// Do this
...(input.field !== undefined && { field: input.field })
// or
field: input.field ?? undefined
```

---

**Next Action**: Implement fixes in priority order, starting with RootStoreProvider.tsx
