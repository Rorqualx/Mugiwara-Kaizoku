# Quick Reference: explicit-module-boundary-types Fixes

**Rule**: `@typescript-eslint/explicit-module-boundary-types`
**Quick Link**: [Full Plan](./EXPLICIT_MODULE_BOUNDARY_TYPES_FIX_PLAN.md)

---

## Common Fix Patterns (Copy-Paste Ready)

### 1. Simple Functions

```typescript
// ❌ Before
export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ✅ After - Add return type
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

### 2. Boolean Checks / Type Guards

```typescript
// ❌ Before
export function isManga(value: unknown) {
  return value && typeof value === 'object' && 'title' in value;
}

// ✅ After - Use type predicate
export function isManga(value: unknown): value is Manga {
  return value !== null &&
         typeof value === 'object' &&
         'title' in value &&
         'id' in value;
}
```

### 3. Async Functions

```typescript
// ❌ Before
export async function fetchManga(id: number) {
  const manga = await prisma.manga.findUnique({ where: { id } });
  return manga;
}

// ✅ After - Add Promise<T> return type
export async function fetchManga(id: number): Promise<Manga | null> {
  const manga = await prisma.manga.findUnique({ where: { id } });
  return manga;
}
```

### 4. React Hooks (Simple)

```typescript
// ❌ Before
export function useConfig() {
  const query = trpc.config.get.useQuery();
  return query;
}

// ✅ After - Add TanStack Query return type
export function useConfig(): UseQueryResult<Config> {
  const query = trpc.config.get.useQuery();
  return query;
}
```

### 5. React Hooks (Complex - Requires Interface)

```typescript
// ❌ Before
export function useLibraryScanner(options: UseScannerOptions = {}) {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const scan = useCallback(async (path: string) => {
    // implementation
  }, []);

  return { scan, isScanning, result };
}

// ✅ After - Define return interface
interface UseLibraryScannerReturn {
  scan: (path: string, libraryId: number, options?: ScanOptions) => Promise<void>;
  isScanning: boolean;
  result: ScanResult | null;
}

export function useLibraryScanner(
  options: UseScannerOptions = {}
): UseLibraryScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const scan = useCallback(async (path: string) => {
    // implementation
  }, []);

  return { scan, isScanning, result };
}
```

### 6. Event Handlers

```typescript
// ❌ Before
export function onClick(event) {
  event.preventDefault();
}

// ✅ After - Add React event type
export function onClick(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
```

**Common React event types**:
- `React.MouseEvent<HTMLButtonElement>`
- `React.FormEvent<HTMLFormElement>`
- `React.ChangeEvent<HTMLInputElement>`
- `React.KeyboardEvent<HTMLDivElement>`

### 7. Callback Functions

```typescript
// ❌ Before
export function processItems(items, callback): void {
  items.forEach(callback);
}

// ✅ After - Add generic types
export function processItems<T>(
  items: T[],
  callback: (item: T) => void
): void {
  items.forEach(callback);
}
```

### 8. Optional Parameters

```typescript
// ❌ Before
export function formatDate(date: Date, format?): string {
  return format ? date.toLocaleDateString(format) : date.toLocaleDateString();
}

// ✅ After - Add optional parameter type
export function formatDate(date: Date, format?: string): string {
  return format ? date.toLocaleDateString(format) : date.toLocaleDateString();
}
```

### 9. Variadic Functions (Rest Parameters)

```typescript
// ❌ Before
export function combine(base: string, ...parts): string {
  return [base, ...parts].join('/');
}

// ✅ After - Add rest parameter type
export function combine(base: string, ...parts: string[]): string {
  return [base, ...parts].join('/');
}
```

### 10. Default Parameters

```typescript
// ❌ Before
export function retry(fn: () => void, attempts = 3): Promise<void> {
  // ...
}

// ✅ After - Add explicit type to default param
export function retry(fn: () => void, attempts: number = 3): Promise<void> {
  // ...
}
```

### 11. Both Missing (Parameters AND Return Type)

```typescript
// ❌ Before - CRITICAL VIOLATION
export function processData(input) {
  return input.map(item => item.value);
}

// ✅ After - Add both parameter and return types
export function processData(input: DataItem[]): number[] {
  return input.map(item => item.value);
}
```

### 12. Void Functions

```typescript
// ❌ Before
export function registerProvider(provider: SearchProvider) {
  searchProviders[provider.name] = provider;
  logger.info(`Registered: ${provider.name}`);
}

// ✅ After - Add :void return type
export function registerProvider(provider: SearchProvider): void {
  searchProviders[provider.name] = provider;
  logger.info(`Registered: ${provider.name}`);
}
```

---

## AST-Grep Search Patterns

### Find violations in a directory
```bash
# Functions missing return types
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/hooks/ | grep -v ': '

# Async functions missing Promise<T>
ast-grep --pattern 'export async function $NAME($$$) { $$$ }' src/server/ | grep -v ': Promise'

# Functions with untyped parameters
ast-grep --pattern 'export function $NAME($PARAM) { $$$ }' src/ | grep -v '$PARAM:'
```

### Count violations per directory
```bash
# Hooks
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/hooks/ | grep -v ': ' | wc -l

# Services
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/server/services/ | grep -v ': ' | wc -l

# Utils
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/utils/ | grep -v ': ' | wc -l
```

---

## Hook Return Type Naming Convention

Follow this pattern for consistency:

| Hook Name | Return Type Interface Name |
|-----------|----------------------------|
| `useLibraryScanner` | `UseLibraryScannerReturn` |
| `useProviderSearch` | `UseProviderSearchReturn` |
| `useMangaDetail` | `UseMangaDetailReturn` |
| `useConfig` | `UseConfigReturn` |

**Alternative**: Use `Result` suffix instead of `Return`
- `UseLibraryScannerResult`
- `UseProviderSearchResult`

**Pick one convention and be consistent within a file!**

---

## Common Type Imports

```typescript
// React events
import type { MouseEvent, FormEvent, ChangeEvent, KeyboardEvent } from 'react';

// TanStack Query
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

// Prisma
import type { Prisma, Manga, Chapter } from '@prisma/client';

// Domain types (preferred)
import type { Manga, MangaStatus } from '@/types/domain/manga-types';
import type { Chapter, ChapterStatus } from '@/types/domain/chapter-types';
```

---

## Validation Checklist

Before committing a batch:

```bash
# ✅ 1. TypeScript compiles
npm run type-check

# ✅ 2. Violations reduced
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l

# ✅ 3. No new errors
git diff src/ | grep "error" | wc -l  # Should be 0

# ✅ 4. Tests pass
npm test -- --findRelatedTests [files-changed]

# ✅ 5. Smart overlap check (bonus!)
npm run lint 2>&1 | grep "explicit-function-return-type" | wc -l
```

---

## Danger Zones ⚠️

### DO NOT use :unknown for hook return types!

```typescript
// ❌ BREAKS DESTRUCTURING - NEVER DO THIS
export function useCustomHook(): unknown {
  return { data, loading };
}
// Component: const { data } = useCustomHook(); ❌ ERROR!

// ✅ ALWAYS create proper interface
interface UseCustomHookReturn {
  data: string;
  loading: boolean;
}

export function useCustomHook(): UseCustomHookReturn {
  return { data, loading };
}
```

### DO NOT use 'any' type

```typescript
// ❌ WRONG
export function processData(input: any): any {
  return input;
}

// ✅ CORRECT - Use unknown with type guards
export function processData(input: unknown): ProcessedData {
  if (!isValidInput(input)) {
    throw new Error('Invalid input');
  }
  return processValidInput(input);
}
```

---

## Priority Order

1. **CRITICAL**: Both parameter AND return type missing (100 violations)
2. **HIGH**: Parameter types missing (120 violations)
3. **MEDIUM**: Return type missing (450 violations)
4. **LOW**: Partial parameters (59 violations)

**Start with CRITICAL, work down the list.**

---

## Smart Overlap Bonus 🎁

When you fix an exported function's return type, you automatically fix the `explicit-function-return-type` violation too!

**Expected bonus**: ~650 additional violations auto-resolved

Track both:
```bash
# Boundary types (primary target)
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l

# Function return types (bonus reduction)
npm run lint 2>&1 | grep "explicit-function-return-type" | wc -l
```

---

## Resources

- **Full Plan**: [EXPLICIT_MODULE_BOUNDARY_TYPES_FIX_PLAN.md](./EXPLICIT_MODULE_BOUNDARY_TYPES_FIX_PLAN.md)
- **Analysis**: [agent-c-boundary-types-analysis.md](./agent-c-boundary-types-analysis.md)
- **Progress**: [TYPE_SAFETY_PROGRESS.md](./TYPE_SAFETY_PROGRESS.md)
- **ESLint Config**: `eslint.config.mjs:108`

---

*Keep this reference open while fixing violations!*
