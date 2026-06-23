# ESLint Rules Reference

*Status: Active*
*Last Updated: 2025-11-03*

## Overview

This document provides comprehensive reference for all ESLint rules enforced in the Mugiwara Kaizoku project. These rules ensure code quality, consistency, and prevent common bugs.

---

## Critical Rules (Build Blockers)

These rules will cause build failures and **MUST** be fixed before committing.

### 1. Nullish Coalescing (`@typescript-eslint/prefer-nullish-coalescing`)

**Rule**: ALWAYS use `??` instead of `||` for default values.

**Why**: The `||` operator treats `0`, `''`, and `false` as falsy, causing bugs. The `??` operator only checks for `null` or `undefined`.

**Error Level**: Error

#### Examples

```typescript
// ❌ WRONG - Uses || which treats 0, '', false as "falsy"
const count = manga.chapters || 0;                    // Bug: 0 chapters becomes 0 (correct) but will fail in other cases
const title = manga.title || 'Unknown';               // Bug: '' becomes 'Unknown'
const isPublished = manga.published || false;         // Bug: false becomes false (correct) but misleading
const score = manga.score || manga.averageScore || 0; // Bug: score of 0 is replaced

// ✅ CORRECT - Uses ?? which only checks for null/undefined
const count = manga.chapters ?? 0;
const title = manga.title ?? 'Unknown';
const isPublished = manga.published ?? false;
const score = manga.score ?? manga.averageScore ?? 0;
```

#### Real-World Bugs This Prevents

```typescript
// Bug example: User has 0 manga in library
const mangaCount = user.mangaCount || 10;  // Shows 10 instead of 0!
const mangaCount = user.mangaCount ?? 10;  // Correctly shows 0

// Bug example: Search with empty string
const searchTerm = input.query || 'default';  // Empty search becomes 'default'!
const searchTerm = input.query ?? 'default';  // Empty string is preserved

// Bug example: Boolean flags
const showNSFW = settings.showNSFW || false;  // If false, becomes false (works)
const showNSFW = settings.showNSFW ?? false;  // More explicit about null check
```

#### Auto-Fix

Some cases can be auto-fixed:

```bash
npx eslint --fix src/path/to/file.ts
```

---

### 2. Import Aliases (`import/no-relative-parent-imports`)

**Rule**: Use `@/` aliases for all internal imports. Never use deep relative paths (`../../`).

**Why**: Relative paths break when files move. Aliases are absolute and refactor-safe.

**Error Level**: Error

#### Examples

```typescript
// ❌ WRONG - Deep relative imports
import { prisma } from '../../server/db';
import { logger } from '../../../utils/logger';
import { Something } from '../../../../lib/something';
import { MangaWithMetadata } from '../../../types/manga';

// ✅ CORRECT - Use @/ aliases
import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';
import { Something } from '@/lib/something';
import type { MangaWithMetadata } from '@/types/manga';
```

#### Import Order (Enforced)

```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. External packages (node_modules)
import { Box, Text } from '@mantine/core';
import { useSession } from 'next-auth/react';

// 3. Internal imports (@/)
import { trpc } from '@/utils/trpc-client';
import { logger } from '@/utils/logger';
import type { MangaWithMetadata } from '@/types/manga';

// 4. Parent imports (../)
import { ParentComponent } from '../ParentComponent';

// 5. Sibling imports (./)
import { SiblingUtil } from './SiblingUtil';

// 6. Type imports (last)
import type { MangaProps } from '@/types/props';
```

#### Auto-Fix

Import order can be auto-fixed:

```bash
npx eslint --fix src/path/to/file.ts
```

---

### 3. Explicit Return Types (`@typescript-eslint/explicit-function-return-type`)

**Rule**: All exported functions MUST have explicit return types.

**Why**: Prevents accidental type changes, improves IDE autocomplete, and makes refactoring safer.

**Error Level**: Error

#### Examples

```typescript
// ❌ WRONG - No return type
export function getManga(id: number) {
  return prisma.manga.findUnique({ where: { id } });
}

export const transformData = (data: unknown[]) => {
  return data.map(item => ({ ...item }));
};

export function HomePage() {
  return <div>Home</div>;
}

// ✅ CORRECT - Explicit return types
export function getManga(id: number): Promise<Manga | null> {
  return prisma.manga.findUnique({ where: { id } });
}

export const transformData = (data: unknown[]): TransformedData[] => {
  return data.map(item => ({ ...item }));
};

export function HomePage(): JSX.Element {
  return <div>Home</div>;
}

// For async functions
export async function fetchManga(id: number): Promise<Manga> {
  const result = await getManga(id);
  if (!result) throw new Error('Not found');
  return result;
}
```

#### Exceptions

Internal/private functions can omit return types if the return type is obvious:

```typescript
// ✅ OK - Internal helper with obvious return type
function add(a: number, b: number) {
  return a + b;
}

// ❌ WRONG - Still needs return type if complex
function processData(data: unknown) {
  return data.map(/* complex transformation */);
}

// ✅ CORRECT
function processData(data: unknown): ProcessedData[] {
  return data.map(/* complex transformation */);
}
```

---

### 4. Unused Variables (`@typescript-eslint/no-unused-vars`)

**Rule**: Prefix unused variables with `_` or remove them.

**Why**: Unused variables indicate dead code or bugs.

**Error Level**: Error

#### Examples

```typescript
// ❌ WRONG - Unused variables
.query(async ({ input, context }) => {
  return getData(input); // context is unused
});

function processData(data: unknown[], options: Options) {
  return data.map(item => item); // options is unused
}

const handleClick = (event: MouseEvent) => {
  console.log('clicked'); // event is unused
};

// ✅ CORRECT - Prefix with underscore
.query(async ({ input, _context }) => {
  return getData(input);
});

function processData(data: unknown[], _options: Options) {
  return data.map(item => item);
}

const handleClick = (_event: MouseEvent) => {
  console.log('clicked');
};

// Or remove entirely
.query(async ({ input }) => {
  return getData(input);
});

function processData(data: unknown[]) {
  return data.map(item => item);
}

const handleClick = () => {
  console.log('clicked');
};
```

#### Catching Unused Imports

```typescript
// ❌ WRONG - Unused import
import { useState, useEffect, useMemo } from 'react'; // useMemo unused

function Component() {
  const [state, setState] = useState(0);
  useEffect(() => {}, []);
  return <div>{state}</div>;
}

// ✅ CORRECT - Remove unused
import { useState, useEffect } from 'react';

function Component() {
  const [state, setState] = useState(0);
  useEffect(() => {}, []);
  return <div>{state}</div>;
}
```

---

### 5. Console Statements (`no-console`)

**Rule**: Never use `console.log`. Use structured logging.

**Why**: Console logs are not structured, not searchable, and clutter production logs.

**Error Level**: Error

#### Examples

```typescript
// ❌ WRONG - console.log
console.log('User logged in:', user);
console.log('Data:', data);
console.log('Processing...');

// ✅ CORRECT - Use logger
import { logger } from '@/utils/logger';

logger.info('User logged in', { userId: user.id, email: user.email });
logger.debug('Processing data', { itemCount: data.length, type: 'manga' });
logger.info('Processing started');

// For errors
logger.error('Failed to fetch manga', {
  error: error.message,
  mangaId: id,
  stack: error.stack
});
```

#### Exceptions (Allowed)

```typescript
// ✅ OK - Warnings and errors
console.warn('Deprecated API usage - migrate to new API');
console.error('Critical error', error);

// ✅ OK - Startup/initialization
console.info('Server starting on port 3000');

// ✅ OK - Development debugging (must remove before commit)
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

---

## Performance Rules

### 6. Await in Loop (`no-await-in-loop`)

**Rule**: Generally avoid `await` in loops. Use `Promise.all()` or controlled batching with ESLint disable comments.

**Why**: Sequential awaits in loops are slow. `Promise.all()` parallelizes operations when possible.

**Error Level**: Warning

**Status**: Set to `warn` in ESLint config (line 379)

#### Pattern 1: Embarrassingly Parallel Operations (Use Promise.all)

**Problem**: Multiple independent operations that don't depend on each other.

**Wrong:**
```typescript
// ❌ WRONG - Sequential (slow!)
async function fetchAllUsers(ids: number[]): Promise<User[]> {
  const users: User[] = [];
  for (const id of ids) {
    const user = await fetchUser(id); // Waits for each sequentially
    users.push(user);
  }
  return users;
}
// Time: O(n) - if each fetch takes 100ms and we have 10 users, total = 1 second
```

**Correct:**
```typescript
// ✅ CORRECT - Parallel with Promise.all
async function fetchAllUsers(ids: number[]): Promise<User[]> {
  return Promise.all(ids.map((id) => fetchUser(id)));
}
// Time: O(1) - if each fetch takes 100ms, total ≈ 100ms (parallel)

// ✅ CORRECT - Controlled concurrency with batch size
async function fetchAllUsersBatched(
  ids: number[],
  batchSize: number = 5
): Promise<User[]> {
  const users: User[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    // Process batch in parallel, but batches sequentially
    // eslint-disable-next-line no-await-in-loop -- Controlled batch processing: batches are parallel internally, sequential for rate limiting
    const batchUsers = await Promise.all(
      batch.map((id) => fetchUser(id))
    );
    users.push(...batchUsers);
  }

  return users;
}
```

#### Pattern 2: Rate-Limited Sequential Processing

**Problem**: Must respect rate limits or API constraints. Parallel execution would violate terms of service.

**Example from codebase**: `src/utils/rate-limiter.ts`

**Correct:**
```typescript
// ✅ CORRECT - Rate-limited sequential processing with explanation
async function processQueue(provider: string): Promise<void> {
  const queue = this.queues.get(provider) ?? [];

  while (queue.length > 0) {
    // Check if we can make a request now
    if (!this.canMakeRequest(provider)) {
      const waitTime = this.getWaitTime(provider);
      if (waitTime > 0) {
        // eslint-disable-next-line no-await-in-loop -- Sequential processing required: must wait for rate limit window before processing next request
        await this.sleep(waitTime);
      }
      continue;
    }

    const request = queue.shift();
    if (!request) continue;

    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential processing required: requests must execute one at a time to respect rate limits
      const result = await request.execute();
      request.resolve(result);
    } catch (error: unknown) {
      request.reject(error);

      // Back off after rate limit errors
      if (this.isRateLimitError(error)) {
        const backoffTime = this.calculateBackoff(provider);
        // eslint-disable-next-line no-await-in-loop -- Sequential processing required: must backoff after rate limit error before processing next request
        await this.sleep(backoffTime);
      }
    }

    // Small delay between requests to be nice to APIs
    // eslint-disable-next-line no-await-in-loop -- Sequential processing required: intentional delay between requests to prevent API abuse
    await this.sleep(50);
  }
}
```

#### Pattern 3: Batch Database Writes

**Example from codebase**: `src/server/trpc/routers/manga/chapter-creation/database.ts`

**Pattern:**
```typescript
// ✅ CORRECT - Batch database writes (sequential batches)
async function batchCreateChaptersInDatabase(
  context: unknown,
  chapters: ChapterToCreate[]
): Promise<void> {
  const batchSize = 50; // Write 50 at a time

  // Sequential batching is intentional to avoid overwhelming the database
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);

    if (isPrismaContext(context)) {
      // eslint-disable-next-line no-await-in-loop -- Batch processing required: must complete each batch before starting next to manage database load
      await context.prisma.chapter.createMany({
        data: batch
      });
      logger.info(`Batch ${Math.floor(i / batchSize) + 1} created successfully`);
    }
  }
}
```

**Why this is correct:**
- Writes happen in controlled batches (50 at a time)
- Each batch completes before the next starts
- Prevents overwhelming database connection pool
- Allows logging progress between batches
- Clear explanation in comment

#### Pattern 4: Sequential Cache Operations

**Example from codebase**: `src/server/parsers/cached-unified-parser/cached-parser.ts`

**Problem:** Cache operations might have internal locks or ordering requirements.

```typescript
// ✅ CORRECT - Sequential cache operations
for (const key of keys) {
  // eslint-disable-next-line no-await-in-loop -- Intentional: cache operations must be sequential per namespace
  const value = await this.cache.get(key, namespace);
  if (value) cached.set(key, value);
}

// ✅ CORRECT - Sequential cache clearing
for (const pattern of patterns) {
  const key = this.generateCacheKey(pattern, {});
  // eslint-disable-next-line no-await-in-loop -- Intentional: cache deletions must be tracked sequentially
  if (await this.cache.delete(key)) count++;
}
```

#### Summary: When to Disable `no-await-in-loop`

| Scenario | Use ESLint Disable? | Alternative | Example |
|----------|-------------------|-------------|---------|
| Parallel fetches | NO | Use `Promise.all()` | Fetch 10 users |
| Rate-limited sequential | YES | N/A - this IS the pattern | API with 5 req/sec limit |
| Batch processing | YES | N/A - controlled batching | Write DB in batches of 50 |
| Sequential cached ops | YES | N/A - cache ordering matters | Cache get/set sequentially |
| Polling/retry with backoff | YES | N/A - need sequential waits | Exponential backoff |

**ESLint Disable Comment Format:**
```typescript
// eslint-disable-next-line no-await-in-loop -- [REASON]: [EXPLANATION]

// Real examples from codebase:
// eslint-disable-next-line no-await-in-loop -- Sequential processing required: requests must execute one at a time to respect rate limits
// eslint-disable-next-line no-await-in-loop -- Batch processing required: must complete each batch before starting next to manage database load
// eslint-disable-next-line no-await-in-loop -- Intentional: cache operations must be sequential per namespace
```

**Key Guidelines:**
- Comment **explains why** sequential processing is required
- Not a performance oversight - it's intentional and necessary
- Includes mechanisms (rate limiting, backoff, delays, batch sizes)
- ESLint disable comment is specific and scoped to that line

---

## Important Rules (Should Follow)

These rules are warnings but should be followed. They may become errors in the future.

### 7. React Hooks Dependencies (`react-hooks/exhaustive-deps`)

**Rule**: Include ALL dependencies in useEffect/useCallback/useMemo.

**Why**: Missing dependencies cause stale closures and hard-to-debug issues.

**Error Level**: Warning

#### Examples

```typescript
// ❌ WRONG - Missing dependencies
function Component({ userId }: Props) {
  useEffect(() => {
    fetchData(userId); // userId is a dependency!
  }, []); // Missing: userId

  const memoized = useMemo(() => {
    return computeValue(userId); // userId is a dependency!
  }, []); // Missing: userId

  const callback = useCallback(() => {
    return processData(userId); // userId is a dependency!
  }, []); // Missing: userId

  return <div />;
}

// ✅ CORRECT - All dependencies included
function Component({ userId }: Props) {
  useEffect(() => {
    fetchData(userId);
  }, [userId]);

  const memoized = useMemo(() => {
    return computeValue(userId);
  }, [userId]);

  const callback = useCallback(() => {
    return processData(userId);
  }, [userId]);

  return <div />;
}
```

#### When to Disable (Rare)

```typescript
// Only run on mount - document the reason
useEffect(() => {
  // Initialize app - should only run once on mount
  initializeApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// When you know better than the linter (rare!)
useEffect(() => {
  // userId is intentionally omitted because...
  // [detailed explanation of why]
  fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [/* userId intentionally omitted */]);
```

---

### 8. Function Complexity (`complexity`)

**Rule**: Keep functions under cyclomatic complexity of 20.

**Why**: Complex functions are hard to test, debug, and maintain.

**Error Level**: Warning

#### Examples

```typescript
// ❌ WRONG - Function too complex (complexity > 20)
export function processData(data: Data[]): ProcessedData[] {
  const result = [];

  for (const item of data) {
    if (item.type === 'A') {
      if (item.status === 'active') {
        if (item.value > 100) {
          // ... 10 more nested conditions
        }
      }
    } else if (item.type === 'B') {
      // ... more complexity
    }
    // ... continues for 200+ lines
  }

  return result;
}

// ✅ CORRECT - Extract sub-functions
export function processData(data: Data[]): ProcessedData[] {
  const validated = validateData(data);
  const transformed = transformData(validated);
  const filtered = filterData(transformed);
  return filtered;
}

function validateData(data: Data[]): Data[] {
  return data.filter(isValid);
}

function transformData(data: Data[]): TransformedData[] {
  return data.map(transformItem);
}

function filterData(data: TransformedData[]): ProcessedData[] {
  return data.filter(shouldInclude);
}
```

---

### 9. Function Length (`max-lines-per-function`)

**Rule**: Keep functions under 150 lines.

**Why**: Long functions are hard to understand and test.

**Error Level**: Warning

#### Examples

```typescript
// ❌ WRONG - Function too long (200+ lines)
export function createManga(data: CreateMangaInput) {
  // 200+ lines of validation, transformation, database operations
}

// ✅ CORRECT - Split into smaller functions
export function createManga(data: CreateMangaInput) {
  validateMangaInput(data);
  const normalized = normalizeMangaData(data);
  const manga = buildMangaObject(normalized);
  return saveManga(manga);
}
```

---

## Project-Specific Rules

### 10. No `any` Types (`@typescript-eslint/no-explicit-any`)

**Rule**: The `any` type is **forbidden** throughout the codebase.

**Why**: `any` defeats TypeScript's type safety. Use `unknown` instead.

**Error Level**: Error

#### Examples

```typescript
// ❌ WRONG - Using any
function processData(data: any) {
  return data.map((item: any) => item.id);
}

const result: any = await fetchData();

// ✅ CORRECT - Use unknown with type guards
function processData(data: unknown): number[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected array');
  }

  return data
    .filter((item): item is { id: number } =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'number'
    )
    .map(item => item.id);
}

const result: unknown = await fetchData();
const validated = validateResult(result); // Type guard
```

---

### 11. Async Function Returns (`@typescript-eslint/require-await`)

**Rule**: Async functions must use `await` or return a Promise.

**Why**: Unnecessary async adds overhead.

**Error Level**: Warning

#### Examples

```typescript
// ❌ WRONG - Async without await
async function getData(id: number) {
  return data.find(item => item.id === id);
}

// ✅ CORRECT - Remove async
function getData(id: number) {
  return data.find(item => item.id === id);
}

// Or if it returns a Promise
async function getData(id: number) {
  return await database.findOne(id);
}
```

---

## Running ESLint

### Check for Issues

```bash
# Check all files
npm run lint

# Or with bun
bun run lint

# Check specific file
npx eslint src/path/to/file.ts

# Check specific directory
npx eslint src/components/
```

### Auto-Fix Issues

```bash
# Fix all auto-fixable issues
npx eslint --fix src/

# Fix specific file
npx eslint --fix src/path/to/file.ts
```

### Before Committing

```bash
# Run full validation
npm run lint
npm run type-check

# Or use the commit command (recommended)
/commit
```

---

## Quick Reference Table

| Rule | Error Level | Auto-Fix | Description |
|------|------------|----------|-------------|
| Nullish coalescing (`??`) | Error | No | Use `??` instead of `||` |
| Import aliases (`@/`) | Error | No | Use `@/` paths, not relative |
| Explicit return types | Error | No | All exports need return types |
| Import order | Error | Yes | Enforce import ordering |
| Unused variables | Error | No | Prefix with `_` or remove |
| Console.log | Error | No | Use `logger` instead |
| React hooks deps | Warning | No | Include all dependencies |
| Function length | Warning | No | Keep under 150 lines |
| Function complexity | Warning | No | Keep complexity under 20 |
| No `any` types | Error | No | Use `unknown` instead |
| Require await | Warning | No | Remove unnecessary async |

---

## Integration with Hooks

The `/commit` command automatically runs ESLint validation and **blocks the commit** if any errors are found.

See [docs/development/hooks-guide.md](../development/hooks-guide.md) for details.

---

## Resources

- **ESLint Config**: [eslint.config.mjs](/eslint.config.mjs)
- **TypeScript ESLint**: https://typescript-eslint.io/
- **React Hooks Rules**: https://react.dev/warnings/invalid-hook-call-warning

---

*Last Updated: 2025-11-19*
*Referenced by: CLAUDE.md, DEVELOPMENT_RULES.md*
*Canonical: Yes*
*Section added: Comprehensive `no-await-in-loop` pattern guide with real codebase examples*
