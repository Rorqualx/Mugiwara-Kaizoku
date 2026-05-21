# no-await-in-loop ESLint Rule - Quick Reference

**Rule:** `no-await-in-loop`
**ESLint Setting:** Warning (line 379 in `eslint.config.mjs`)
**Type:** Performance Rule
**Rationale:** Sequential awaits in loops are slower than parallelization with `Promise.all()`

---

## Quick Decision Tree

```
Does your loop have independent operations?
├─ YES (e.g., fetching multiple users)
│  └─ Use Promise.all() - NO ESLint disable needed
│     Example: await Promise.all(ids.map(id => fetchUser(id)))
│
└─ NO, they must be sequential because:
   ├─ Rate limits/API constraints?
   │  └─ Use ESLint disable with rate-limit explanation
   │     Example: API allows 5 requests/second
   │
   ├─ Database connection pool management?
   │  └─ Use ESLint disable with batch explanation
   │     Example: Write 50 records at a time
   │
   ├─ Cache operations with ordering requirements?
   │  └─ Use ESLint disable with cache explanation
   │     Example: Cache namespace-specific ordering
   │
   └─ Exponential backoff/retry logic?
      └─ Use ESLint disable with backoff explanation
         Example: Increasing wait times after errors
```

---

## The Rule Explained

### Why It Exists

Sequential awaits in loops are slow:
```typescript
// ❌ SLOW - Takes 1 second for 10 items at 100ms each
for (const id of ids) {
  await fetchUser(id); // Waits 100ms per item = 1000ms total
}

// ✅ FAST - Takes ~100ms for 10 items in parallel
await Promise.all(ids.map(id => fetchUser(id))); // All parallel = 100ms total
```

### When To Override

**You MUST provide an ESLint disable comment that explains why sequential processing is necessary.**

The comment format:
```typescript
// eslint-disable-next-line no-await-in-loop -- [CATEGORY]: [EXPLANATION]
```

---

## Legitimate Patterns

### Pattern 1: Parallel Fetches (NO disable needed)

**Scenario:** Fetching independent data from an API

```typescript
// ✅ CORRECT - No disable needed, this is the right pattern
async function fetchAllUsers(ids: number[]): Promise<User[]> {
  return Promise.all(ids.map(id => fetchUser(id)));
}

// ✅ CORRECT - Batch with concurrency control
async function fetchAllUsersBatched(
  ids: number[],
  batchSize: number = 5
): Promise<User[]> {
  const users: User[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop -- Controlled batch processing: batches are parallel internally, sequential for rate limiting
    const batchUsers = await Promise.all(
      batch.map(id => fetchUser(id))
    );
    users.push(...batchUsers);
  }

  return users;
}
```

**Key:** Use `Promise.all()` to parallelize. Batch size controls concurrency.

---

### Pattern 2: Rate-Limited API Requests

**Scenario:** API has rate limits (e.g., 5 requests/second)

**From codebase:** `src/utils/rate-limiter.ts`

```typescript
// ✅ CORRECT - Rate-limited processing with detailed explanation
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

      // Exponential backoff on rate limit errors
      if (this.isRateLimitError(error)) {
        const backoffTime = this.calculateBackoff(provider);
        // eslint-disable-next-line no-await-in-loop -- Sequential processing required: must backoff after rate limit error before processing next request
        await this.sleep(backoffTime);
      }
    }

    // Small delay between requests
    // eslint-disable-next-line no-await-in-loop -- Sequential processing required: intentional delay between requests to prevent API abuse
    await this.sleep(50);
  }
}
```

**Key mechanisms:**
- Rate limit checking (`canMakeRequest()`)
- Exponential backoff on errors
- Inter-request delays

---

### Pattern 3: Batch Database Writes

**Scenario:** Writing large amounts of data. Don't want to overwhelm connection pool.

**From codebase:** `src/server/trpc/routers/manga/chapter-creation/database.ts`

```typescript
// ✅ CORRECT - Batch writes with size control
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

**Key features:**
- Fixed batch size (50)
- Sequential batch processing
- Logging between batches

---

### Pattern 4: Cache Operations

**Scenario:** Cache reads/writes might have ordering constraints or need to track state.

**From codebase:** `src/server/parsers/cached-unified-parser/cached-parser.ts`

```typescript
// ✅ CORRECT - Sequential cache gets with ordering guarantee
for (const key of keys) {
  // eslint-disable-next-line no-await-in-loop -- Intentional: cache operations must be sequential per namespace
  const value = await this.cache.get(key, namespace);
  if (value) cached.set(key, value);
}

// ✅ CORRECT - Sequential cache deletes with tracking
for (const pattern of patterns) {
  const key = this.generateCacheKey(pattern, {});
  // eslint-disable-next-line no-await-in-loop -- Intentional: cache deletions must be tracked sequentially
  if (await this.cache.delete(key)) count++;
}
```

**Why sequential:**
- Namespace-specific ordering
- Need to track deletion count
- Prevent race conditions

---

## Comment Format Standards

All ESLint disable comments must follow this format:

```typescript
// eslint-disable-next-line no-await-in-loop -- [REASON]: [EXPLANATION]
```

### Real Examples From Codebase

**Rate Limiting:**
```typescript
// eslint-disable-next-line no-await-in-loop -- Sequential processing required: requests must execute one at a time to respect rate limits
```

**Batch Processing:**
```typescript
// eslint-disable-next-line no-await-in-loop -- Batch processing required: must complete each batch before starting next to manage database load
```

**Cache Operations:**
```typescript
// eslint-disable-next-line no-await-in-loop -- Intentional: cache operations must be sequential per namespace
```

### What Makes a Good Comment

1. **Explains WHY** (not just "this is needed")
2. **Identifies the constraint** (rate limit, batch size, cache ordering)
3. **Is concise** (one line)
4. **Matches the actual code** (no generic comments)

---

## Anti-Patterns (Don't Do This)

### Missing Explanation
```typescript
// ❌ WRONG - No explanation
for (const item of items) {
  await process(item); // ESLint warning with no comment
}
```

### Generic Comment
```typescript
// ❌ WRONG - Doesn't explain the actual reason
// eslint-disable-next-line no-await-in-loop -- Sequential processing required
```

### When You Should Use Promise.all Instead
```typescript
// ❌ WRONG - These are independent, use Promise.all!
for (const item of items) {
  // eslint-disable-next-line no-await-in-loop -- Intentional sequential processing
  const result = await fetch(item); // But there's no actual reason for this!
}

// ✅ CORRECT - Just use Promise.all
const results = await Promise.all(items.map(item => fetch(item)));
```

---

## Quick Checklist

Before adding an ESLint disable comment:

- [ ] Do operations **actually need** to be sequential?
  - If NO, use `Promise.all()` instead
  - If YES, continue...

- [ ] Can I explain **why** in one line?
  - If NO, refactor to make it clearer
  - If YES, continue...

- [ ] Is the explanation **specific** to this code?
  - If NO, rewrite to be more specific
  - If YES, add the comment

**Example:**
```typescript
// Before: "why am I doing this sequentially?"
for (const id of ids) {
  await saveUser(id); // ??? No clear reason
}

// After: "because of rate limiting"
for (const id of ids) {
  // eslint-disable-next-line no-await-in-loop -- Sequential processing required: API rate limit is 5 requests/second
  await saveUser(id);
}
```

---

## Related Configuration

**File:** `eslint.config.mjs`

**Setting:**
```javascript
rules: {
  'no-await-in-loop': 'warn', // Line 379
}
```

**Classification:** Performance Rules (lines 375-379)

---

## Further Reading

- **Full ESLint Reference:** `docs/eslint/eslint-rules-reference.md` (Section: "Performance Rules" → "Await in Loop")
- **Rate Limiter Implementation:** `src/utils/rate-limiter.ts`
- **Batch Processing Example:** `src/server/trpc/routers/manga/chapter-creation/database.ts`
- **Cache Example:** `src/server/parsers/cached-unified-parser/cached-parser.ts`

---

*Last Updated: 2025-11-19*
*Quick Reference for: no-await-in-loop ESLint Rule*
*See full reference in docs/eslint/eslint-rules-reference.md for comprehensive guide*
