# no-unsafe-assignment Quick Reference Card

**Version:** 1.0 | **Created:** 2025-11-09

---

## 🎯 Immediate Actions (First 2-3 Hours)

### Step 1: Add PackDownload Model (30 min)

```bash
# 1. Open prisma/schema.prisma
# 2. Add after KapowarrDownload model (around line 220):
```

```prisma
model PackDownload {
  id                BigInt                   @id @default(autoincrement())
  releaseTitle      String
  volumeStart       Int?
  volumeEnd         Int?
  mangaId           Int
  jobId             BigInt
  downloadId        String
  clientType        String
  indexer           String?
  protocol          String
  status            PackDownloadStatus       @default(DOWNLOADING)
  fileSize          BigInt?
  filePath          String?
  errorMessage      String?
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt
  completedAt       DateTime?
  manga             Manga                    @relation(fields: [mangaId], references: [id], onDelete: Cascade)
  chapters          Chapter[]
  @@index([mangaId])
  @@index([status])
  @@index([downloadId])
  @@index([jobId])
  @@map("pack_download")
}

enum PackDownloadStatus {
  DOWNLOADING
  COMPLETED
  IMPORTING
  IMPORTED
  FAILED
  CANCELLED
}
```

```bash
# 3. Update Chapter model (add these lines):
```

```prisma
model Chapter {
  # ... existing fields ...
  packDownloadId    BigInt?
  PackDownload      PackDownload?  @relation(fields: [packDownloadId], references: [id], onDelete: SetNull)
  @@index([packDownloadId])
}
```

```bash
# 4. Run migration:
npx prisma migrate dev --name add_pack_download_model
npx prisma generate
npx tsc --noEmit  # Verify
```

### Step 2: Fix 3 Download Files (1-2h)

**Files to edit:**
1. `src/server/services/download/downloadMonitor.ts`
2. `src/server/services/download/downloadManager.ts`
3. `src/server/services/packImport/deduplication.ts`

**Changes:**
- ❌ Remove: First line `// @ts-nocheck`
- ❌ Remove: Lines 376-400 (dynamic Prisma access)
- ✅ Replace with: `await this.prismaClient.packDownload.findFirst({...})`

---

## 📋 Common Fix Patterns

### Pattern 1: Array Access

```typescript
// ❌ Before
const firstItem = array[0];

// ✅ After
const firstItem = array[0] ?? DEFAULT_ITEM;
// or
const firstItem = array.at(0);
if (!firstItem) throw new Error('No items found');
```

### Pattern 2: JSON.parse()

```typescript
// ❌ Before
const data = JSON.parse(jsonString);

// ✅ After
import { z } from 'zod';

const DataSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const parsed: unknown = JSON.parse(jsonString);
const result = DataSchema.safeParse(parsed);
if (!result.success) {
  return AsyncResult.err(new ValidationError('Invalid data'));
}
const data = result.data; // Typed!
```

### Pattern 3: API Response

```typescript
// ❌ Before
const response = await axios.get(url);
const data = response.data; // any

// ✅ After
const ResponseSchema = z.object({ status: z.string() });

const response = await axios.get<unknown>(url);
const result = ResponseSchema.safeParse(response.data);
if (!result.success) {
  return AsyncResult.err(new ValidationError('Invalid response'));
}
const data = result.data; // Typed!
```

### Pattern 4: LocalStorage

```typescript
// ❌ Before
const stored = localStorage.getItem('key');
const data = JSON.parse(stored);

// ✅ After
const DataSchema = z.object({ theme: z.string() });

const stored = localStorage.getItem('key');
if (!stored) return DEFAULT_DATA;

const parsed: unknown = JSON.parse(stored);
const result = DataSchema.safeParse(parsed);
if (!result.success) return DEFAULT_DATA;
return result.data; // Typed!
```

### Pattern 5: Third-Party Types

```typescript
// ❌ Before
import { FixedSizeList } from 'react-window';
// @ts-expect-error - types incomplete
const List = FixedSizeList as ListComponent;

// ✅ After
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
// Proper types imported, no cast needed
```

---

## 🚫 Suppression Policy (STRICT)

### Only 4 Allowed Cases:

1. **External library bug** (with issue link)
2. **External library limitation** (missing exports)
3. **Platform limitation** (API type gaps)
4. **Temporary WIP** (with TODO + tracking)

### Required Format:

```typescript
/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
// Reason: <specific explanation>
// Reference: <link to issue/docs>
// TODO: <removal condition>
<code>
```

### ❌ NEVER Allowed:

- `@ts-nocheck` (except temporary Prisma migration)
- `eslint-disable` without `eslint-enable`
- No explanation comment
- "Will fix later" without TODO/tracking
- Using `any` in tests

---

## 📊 Progress Tracking

```bash
# Copy template
cp docs/eslint/PROGRESS_TRACKING_TEMPLATE.md docs/eslint/PROGRESS_TRACKING.md

# Update after each batch:
# - Mark batch complete
# - Update violation counts
# - Log commit SHA
# - Add to velocity tracking
```

---

## ✅ Validation Checklist (After Each Batch)

```bash
# 1. TypeScript compilation
npx tsc --noEmit
# Expected: 0 new errors

# 2. ESLint check
npx eslint . --format json > /tmp/eslint-after.json
# Compare violation counts

# 3. Run tests
npm test
# Expected: All passing tests still pass

# 4. Commit if all pass
git add .
git commit -m "fix(eslint): Batch X.Y - <description>"
```

---

## 🔍 Search Commands

```bash
# Find JSON.parse calls
ast-grep --pattern 'JSON.parse($$$)' src/

# Find array access
ast-grep --pattern '$ARRAY[$INDEX]' src/

# Find localStorage usage
ast-grep --pattern 'localStorage.getItem($$$)' src/

# Find type assertions
ast-grep --pattern '$VAR as any' src/

# Find dynamic property access
ast-grep --pattern '$OBJ[$KEY]' src/
```

---

## 📚 Documentation Index

| Document | Purpose | Lines |
|----------|---------|-------|
| **Executive Summary** | One-page overview | 488 |
| **Systematic Plan** | Complete strategy | 911 |
| **Prisma Guide** | Add missing models | 475 |
| **Zod Templates** | API validation | 1,024 |
| **Suppression Policy** | When to suppress | 691 |
| **Progress Tracker** | Track execution | 398 |
| **Quick Reference** ← | This card | - |

**Location:** `docs/eslint/NO_UNSAFE_ASSIGNMENT_*`

---

## 🎯 Phase Breakdown

### Phase 1: Quick Wins (4-7h) → 538 violations

- **1.1** Array access (1-2h) → ~100 violations
- **1.2** LocalStorage (1h) → ~60 violations
- **1.3** Third-party types (1-2h) → ~80 violations
- **1.4** Simple assertions (1-2h) → ~298 violations

### Phase 2: API Types (15-20h) → 673 violations

- **2.1** Define interfaces (3-4h) → Infrastructure
- **2.2** JSON.parse (5-6h) → ~240 violations
- **2.3** API responses (6-8h) → ~240 violations
- **2.4** Dynamic access (4-5h) → ~193 violations

### Phase 3: Complex (8-11h) → 135 violations

- **3.1** Prisma dynamic (3-5h) → ~50 violations
- **3.2** Nested transforms (3-4h) → ~50 violations
- **3.3** Test files (2h) → ~35 violations

**Total:** 28-38 hours → 1,346 violations → 0

---

## ⚡ Helper Functions (Ready to Use)

**File:** `src/utils/json-validation.ts` (create if missing)

```typescript
import { z } from 'zod';
import { AsyncResult } from '@/types/result-types';

export function parseJsonWithSchema<T>(
  jsonString: string,
  schema: z.ZodSchema<T>
): AsyncResult<T> {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return AsyncResult.err(new ValidationError('Invalid JSON'));
    }
    return AsyncResult.ok(result.data);
  } catch (error) {
    return AsyncResult.err(new ValidationError('Parse failed'));
  }
}

export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): AsyncResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return AsyncResult.err(new ValidationError('Invalid data'));
  }
  return AsyncResult.ok(result.data);
}

export function parseStorageItem<T>(
  key: string,
  schema: z.ZodSchema<T>,
  storage: Storage = localStorage
): T | null {
  const stored = storage.getItem(key);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      storage.removeItem(key);
      return null;
    }
    return result.data;
  } catch {
    storage.removeItem(key);
    return null;
  }
}
```

---

## 💡 Tips

- **Small batches**: 20-30 files per commit
- **Validate often**: After each batch
- **Use templates**: Don't reinvent schemas
- **Ask for help**: If pattern not in guide
- **Track progress**: Update PROGRESS_TRACKING.md daily

---

## 🆘 Troubleshooting

**Q: TypeScript errors after Prisma generate?**
```bash
npx prisma generate --force
rm -rf .next node_modules/.cache
```

**Q: Migration fails?**
```bash
npx prisma migrate reset
npx prisma migrate dev --name <name>
```

**Q: ESLint violations not decreasing?**
- Check file is in correct batch
- Verify pattern was applied correctly
- Run ESLint with --fix flag first

---

**Print this card and keep handy while fixing violations!**

**Last Updated:** 2025-11-09
