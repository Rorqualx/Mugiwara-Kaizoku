# Wave 1-2 Quick Reference Guide

**Quick Start:** This guide provides quick lookup for common patterns and fixes during batch execution.

---

## Pattern Recognition Cheat Sheet

### 1. Double Casts (as unknown as)

**Recognition:**
```typescript
expr as unknown as T
```

**Common Locations:**
- Error handling: `error as unknown as E`
- Type transformations: `result as unknown as AsyncResult<T, E>`
- Component props: `manga as unknown as MangaWithRelations`

**Fix Template:**
```typescript
// Before
error as unknown as E

// After - Option 1: Type Guard
function toErrorType<E extends Error>(error: unknown): E {
  return error instanceof Error ? (error as E) : new Error(String(error)) as E;
}

// After - Option 2: Proper Type Definition
if (!isMangaWithRelations(manga)) {
  throw new ValidationError('Invalid manga format');
}
// manga is now typed correctly
```

---

### 2. as any Casts

**Recognition:**
```typescript
expr as any
```

**Common Locations:**
- Metadata access: `(metadata as any).field`
- Browser APIs: `(screen as any).orientation`
- Settings checks: `(settings.data as any)?.enabled`
- AsyncResult extraction: `(result as any).data`

**Fix Templates:**

#### A. Dynamic Property Access
```typescript
// Before
const value = (metadata as any).field;

// After
interface Metadata {
  field?: string;
  [key: string]: unknown;
}

function isMetadata(obj: unknown): obj is Metadata {
  return typeof obj === 'object' && obj !== null;
}

if (isMetadata(metadata)) {
  const value = metadata.field;
}
```

#### B. Browser APIs
```typescript
// Before
if ((elem as any).webkitRequestFullscreen) {
  await (elem as any).webkitRequestFullscreen();
}

// After - Create global augmentation in src/types/browser-apis.d.ts
interface Element {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
}

// Usage
if (elem.webkitRequestFullscreen) {
  await elem.webkitRequestFullscreen();
}
```

#### C. AsyncResult Extraction
```typescript
// Before
if (isSuccess(result as any) && (result as any).data) {
  const manga = (result as any).data as any;
}

// After
if (isSuccess(result)) {
  const manga = result.data; // Already properly typed
}
```

#### D. Enum-like Values
```typescript
// Before
fileStatus: 'PENDING' as any,
libraryStatus: 'ACTIVE' as any,

// After
import { FileStatus, LibraryStatus } from '@prisma/client';

fileStatus: FileStatus.PENDING,
libraryStatus: LibraryStatus.ACTIVE,
```

---

### 3. Explicit any Declarations

**Recognition:**
```typescript
variable: any
parameter: any
property: any
```

**Common Locations:**
- Callback parameters: `(value: any) => void`
- Component props: `data?: any`
- Generic holders: `metadata?: any`

**Fix Templates:**

#### A. Callback Parameters
```typescript
// Before
onUpdate: (value: any, source: string) => void

// After
type FieldValue = string | number | boolean | string[] | null | undefined;
onUpdate: (value: FieldValue, source: string) => void
```

#### B. Component Props
```typescript
// Before
interface Props {
  data?: any;
  metadata?: any;
}

// After
interface Props {
  data?: Record<string, unknown>;
  metadata?: ProviderMetadata;
}
```

#### C. Generic Data
```typescript
// Before
const handleUpdate = (field: string, value: any) => {
  // ...
};

// After
type MetadataFieldValue = string | number | string[] | Date | null;

const handleUpdate = (field: string, value: MetadataFieldValue): void => {
  if (typeof value === 'string') {
    // String operations
  } else if (Array.isArray(value)) {
    // Array operations
  }
};
```

---

### 4. Object.assign

**Recognition:**
```typescript
Object.assign(target, source)
```

**Common Locations:**
- State mutations: `Object.assign(state, updates)`
- Object merging: `Object.assign(merged, primary)`
- Test mocking: `Object.assign(console, mocks)`

**Fix Template:**
```typescript
// Before
Object.assign(state, updates);

// After
return { ...state, ...updates };

// Before (Zustand)
updateInfo: (info) => {
  Object.assign(state, info);
}

// After (Zustand with immer)
updateInfo: (info) => {
  return { ...state, ...info };
}
```

---

## Common Type Definitions

### Metadata Types
```typescript
// Provider Metadata
interface ProviderMetadata {
  [provider: string]: {
    descriptions?: {
      main?: string;
      synopsis?: string;
      plot?: string;
      background?: string;
    };
    coverImage?: string;
    chapters?: number;
    volumes?: number;
  };
}

// Field Value Union
type FieldValue = string | number | boolean | string[] | null | undefined;

// Metadata Field Value
type MetadataFieldValue = string | number | string[] | Date | null;
```

### Browser API Augmentations
```typescript
// src/types/browser-apis.d.ts
interface Element {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
}

interface Screen {
  orientation?: {
    lock: (orientation: OrientationLockType) => Promise<void>;
    unlock: () => void;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
  };
}
```

### Settings Types
```typescript
interface DownloadClientSettings {
  transmission?: {
    enabled: boolean;
    host: string;
    port: number;
  };
  deluge?: {
    enabled: boolean;
    host: string;
    port: number;
  };
  nzbget?: {
    enabled: boolean;
    host: string;
    port: number;
  };
  qbittorrent?: {
    enabled: boolean;
    host: string;
    port: number;
  };
}

interface ProwlarrSettings {
  prowlarrBaseURL?: string;
  prowlarrApiKey?: string;
}

type ApplicationSettings = DownloadClientSettings & ProwlarrSettings;
```

---

## Type Guards Library

Create these in `src/utils/type-guards/` as needed:

```typescript
// src/utils/type-guards/metadata.ts
export function isProviderMetadata(obj: unknown): obj is ProviderMetadata {
  return typeof obj === 'object' && obj !== null;
}

export function isMangaWithRelations(obj: unknown): obj is MangaWithRelations {
  if (typeof obj !== 'object' || obj === null) return false;
  const manga = obj as Record<string, unknown>;
  return (
    typeof manga.id === 'number' &&
    typeof manga.title === 'string' &&
    (manga.Chapter === undefined || Array.isArray(manga.Chapter))
  );
}

// src/utils/type-guards/errors.ts
export function toErrorType<E extends Error>(error: unknown): E {
  if (error instanceof Error) {
    return error as E;
  }
  return new Error(String(error)) as E;
}

// src/utils/type-guards/settings.ts
export function hasDownloadClient(
  settings: unknown,
  client: 'transmission' | 'deluge' | 'nzbget' | 'qbittorrent'
): settings is ApplicationSettings {
  if (typeof settings !== 'object' || settings === null) return false;
  const s = settings as Record<string, unknown>;
  return (
    typeof s[client] === 'object' &&
    s[client] !== null &&
    (s[client] as Record<string, unknown>).enabled === true
  );
}
```

---

## Batch Execution Checklist

### Pre-Batch
- [ ] Read batch plan for current batch
- [ ] Review key files listed
- [ ] Identify primary pattern type
- [ ] Choose appropriate fix strategy

### During Batch
- [ ] Apply fixes systematically
- [ ] Create type guards as needed
- [ ] Add global type augmentations if required
- [ ] Update imports to use new types
- [ ] Maintain consistent naming conventions

### Post-Batch
- [ ] Run `bun run type-check`
- [ ] Run `bun run lint`
- [ ] Verify no new violations
- [ ] Run affected tests
- [ ] Commit with descriptive message

### Validation Commands
```bash
# Type check
bun run type-check

# Lint check
bun run lint

# Fix auto-fixable issues
bun run lint --fix

# Run specific tests
bun test src/path/to/__tests__/
```

---

## Common Pitfalls

### ❌ Don't Do This

```typescript
// Don't create new any types
const data: any = result.data;

// Don't use as any to bypass errors
return (result as any).data as any;

// Don't use Object.assign with mutation
Object.assign(state, newState);

// Don't ignore type guards
const value = obj.field; // without checking
```

### ✅ Do This Instead

```typescript
// Create proper types
const data: ResultData = result.data;

// Use type guards
if (isSuccess(result)) {
  return result.data;
}

// Use spread syntax
return { ...state, ...newState };

// Always validate
if (isValidObject(obj)) {
  const value = obj.field;
}
```

---

## Priority Files Requiring Extra Care

| File | Reason | Special Considerations |
|------|--------|------------------------|
| `src/pages/manga/[id].tsx` | 37 violations, high traffic | Test thoroughly, metadata access patterns |
| `src/utils/mobile/orientation.ts` | 31 violations, browser APIs | Create global type augmentations first |
| `src/server/trpc/routers/metadata.ts` | 29 violations, API layer | AsyncResult handling critical |
| `src/utils/async-result.ts` | 22 violations, foundation | Changes affect entire codebase |
| `src/server/trpc/routers/search.ts` | 23 violations, search API | Performance-sensitive |

---

## Helpful Patterns by Module

### tRPC Routers
```typescript
// Pattern: AsyncResult extraction
if (!isSuccess(result)) {
  return createErrorResult(result.error);
}
return createSuccessResult(result.data);
```

### Components
```typescript
// Pattern: Settings checks
import { hasDownloadClient } from '@/utils/type-guards/settings';

if (hasDownloadClient(settings, 'transmission')) {
  // settings.transmission is now typed
}
```

### Hooks
```typescript
// Pattern: Type guards for hook results
if (!manga || !isMangaWithRelations(manga)) {
  return null;
}
// manga is now MangaWithRelations
```

---

## Questions During Execution?

1. **Can't determine proper type?** Use `Record<string, unknown>` temporarily and add TODO
2. **Multiple possible types?** Create a union type
3. **Browser API missing?** Add to `src/types/browser-apis.d.ts`
4. **Test failing after fix?** Check if test assumptions changed
5. **Type too complex?** Break into smaller interfaces

---

## Success Metrics

After each batch:
- ✅ Type errors: Should decrease or stay same (never increase)
- ✅ ESLint violations: Should decrease for target pattern
- ✅ Tests: Should pass (same or more)
- ✅ Build: Should succeed
- ✅ Runtime: No new errors in development

---

**Good luck with execution!**
**Refer to full analysis-report.md for detailed context.**
