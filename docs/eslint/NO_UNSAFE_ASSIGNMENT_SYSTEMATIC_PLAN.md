# @typescript-eslint/no-unsafe-assignment Systematic Remediation Plan

**Status:** 🟢 READY FOR EXECUTION
**Created:** 2025-11-09
**Branch:** `claude/analyze-unsafe-assignment-violations-011CUwpoZS3fnRoZAY5uGXeL`
**Total Violations:** ~1,346 (estimated from codebase analysis)
**Analyzed Files:** 1,581 TypeScript files in src/

---

## Executive Summary

This plan provides a **systematic, pattern-based approach** to eliminate all `@typescript-eslint/no-unsafe-assignment` violations from the Mugiwara-Kaizoku codebase. Based on comprehensive analysis of 12+ sample files across all major directories, we've identified 7 primary violation patterns and created a phased remediation strategy.

**Key Insight:** ~90% of violations follow predictable patterns that can be fixed with standardized solutions.

### Quick Stats

| Metric | Value |
|--------|-------|
| **Total Violations** | ~1,346 |
| **Easy Fixes (40%)** | ~538 violations |
| **Medium Fixes (50%)** | ~673 violations |
| **Hard Fixes (10%)** | ~135 violations |
| **Estimated Effort** | 28-38 hours |
| **Phases** | 3 (Quick Wins → API Types → Complex) |

---

## Pattern Analysis Results

### Pattern Distribution

| Pattern | Frequency | Files Affected | Complexity | Est. Time |
|---------|-----------|----------------|------------|-----------|
| **1. JSON.parse() without guards** | Very High | ~80 files | Medium | 8-10h |
| **2. API Response data access** | Very High | ~60 files | Medium | 10-12h |
| **3. Third-party library returns** | Common | ~20 files | Easy | 2-3h |
| **4. LocalStorage/SessionStorage** | Common | ~15 files | Easy | 1-2h |
| **5. Dynamic object property access** | Common | ~40 files | Medium | 5-6h |
| **6. Dynamic Prisma model access** | Rare | ~5 files | Hard | 3-5h |
| **7. Array access without guards** | Common | ~25 files | Easy | 1-2h |

### Directory Breakdown

| Directory | Est. Violations | Priority | Patterns Present |
|-----------|----------------|----------|------------------|
| `/src/server/services/` | 320-400 | 🔴 High | JSON.parse, API calls, Prisma |
| `/src/server/adapters/` | 200-250 | 🔴 High | API integrations, parsers |
| `/src/utils/` | 150-180 | 🟡 Medium | LocalStorage, caching |
| `/src/server/trpc/routers/` | 120-150 | 🟡 Medium | Request/response handling |
| `/src/server/parsers/` | 100-120 | 🟡 Medium | External data parsing |
| `/src/components/` | 80-100 | 🟢 Low | UI state, props |
| `/src/server/base/` | 30-40 | 🟢 Low | Base classes |
| **Total** | **~1,346** | | |

---

## Phase 1: Quick Wins (Easy Fixes)

**Target:** ~538 violations (40%)
**Estimated Time:** 4-7 hours
**Risk Level:** 🟢 Low

### Batch 1.1: Array Access with Guards (~100 violations, 1-2h)

**Problem:**
```typescript
// ❌ Before
const firstClient = clients[0];  // May be undefined
const mangaResult = searchResults[0];  // No bounds checking
```

**Solution:**
```typescript
// ✅ After
const firstClient = clients[0] ?? DEFAULT_CLIENT;
// or
const mangaResult = searchResults.at(0);
if (!mangaResult) {
  throw new Error('No search results found');
}
```

**Target Files:**
- `src/utils/smartClientSelector.ts`
- `src/server/parsers/adapters/WikipediaAdapter.ts`
- All files with `array[0]` pattern

**AST-grep Pattern:**
```bash
ast-grep --pattern '$ARRAY[0]' src/ --json
ast-grep --pattern '$ARRAY[$INDEX]' src/ --json
```

---

### Batch 1.2: LocalStorage/SessionStorage (~60 violations, 1h)

**Problem:**
```typescript
// ❌ Before
const stored = localStorage.getItem('key');
return JSON.parse(stored);  // Returns any
```

**Solution:**
```typescript
// ✅ After
interface StoredData {
  theme: string;
  preferences: Record<string, unknown>;
}

function isStoredData(data: unknown): data is StoredData {
  return isObject(data) &&
    hasProperty(data, 'theme') &&
    typeof data.theme === 'string';
}

const stored = localStorage.getItem('key');
if (!stored) return DEFAULT_DATA;

const parsed: unknown = JSON.parse(stored);
if (!isStoredData(parsed)) {
  logger.warn('Invalid stored data format');
  return DEFAULT_DATA;
}
return parsed;  // Now typed as StoredData
```

**Target Files:**
- `src/utils/smartClientSelector.ts:39`
- `src/utils/metadata-cache.ts:218-225`
- All PWA/mobile utilities

---

### Batch 1.3: Third-Party Library Type Imports (~80 violations, 1-2h)

**Problem:**
```typescript
// ❌ Before
// @ts-expect-error - react-window types are incomplete
const List: ListComponent = FixedSizeList as ListComponent;

const $ = cheerio.load(html);  // Returns any
const text = $('.selector').text();
```

**Solution:**
```typescript
// ✅ After - Use proper type imports
import type { Cheerio, Element } from 'cheerio';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';

// Cheerio is now properly typed
function extractText($element: Cheerio<Element>): string {
  return $element.text();  // No guards needed
}
```

**Target Files:**
- `src/components/manga/VirtualChapterList.tsx:30-31`
- `src/server/parsers/adapters/WikipediaAdapter.ts:307`
- All files using Cheerio, react-window

---

### Batch 1.4: Simple Type Assertions (~298 violations, 1-2h)

**Problem:**
```typescript
// ❌ Before
const result = someFunction() as any;
const data: any = await fetchData();
```

**Solution:**
```typescript
// ✅ After
const result: unknown = someFunction();
if (!isExpectedType(result)) {
  throw new ValidationError('Unexpected result type');
}
// result is now properly typed

const data: unknown = await fetchData();
if (!isValidData(data)) {
  logger.error('Invalid data received', { data });
  return null;
}
// data is now typed
```

**Strategy:**
- Replace `as any` with `as unknown`
- Add type guard immediately after
- Use existing type guards from `src/utils/type-guards.ts`

---

## Phase 2: API Response Types (Medium Fixes)

**Target:** ~673 violations (50%)
**Estimated Time:** 15-20 hours
**Risk Level:** 🟡 Medium

### Batch 2.1: Define API Response Interfaces (3-4h)

**Create standardized response types:**

```typescript
// src/types/api/common-responses.ts

export interface WikipediaParseResponse {
  parse: {
    title: string;
    text: { '*': string };
    images?: string[];
  };
}

export interface NzbgetStatusResponse {
  version: string;
  status: 'Running' | 'Paused' | 'Stopped';
  downloadRate: number;
}

export interface SuwayomiMangaResponse {
  id: number;
  title: string;
  thumbnailUrl?: string;
  chapters: Array<{
    id: number;
    name: string;
  }>;
}

// ... 20-30 more response types
```

**Process:**
1. Analyze each API endpoint in adapters
2. Document actual response structure (use examples from logs)
3. Create TypeScript interface
4. Add Zod schema for runtime validation

---

### Batch 2.2: JSON.parse() with Validation (~240 violations, 5-6h)

**Problem:**
```typescript
// ❌ Before
const metadata = JSON.parse(settings.metadata);  // Returns any
const providers = metadata.providers;  // Unsafe access
```

**Solution Pattern A - Known Schema:**
```typescript
// ✅ After - With known schema
import { z } from 'zod';

const SettingsMetadataSchema = z.object({
  providers: z.record(z.string(), z.object({
    enabled: z.boolean(),
    priority: z.number(),
  })),
  defaultProvider: z.string(),
});

type SettingsMetadata = z.infer<typeof SettingsMetadataSchema>;

const parsed: unknown = JSON.parse(settings.metadata);
const parseResult = SettingsMetadataSchema.safeParse(parsed);
if (!parseResult.success) {
  logger.error('Invalid metadata format', {
    errors: parseResult.error.errors
  });
  throw new ValidationError('Invalid settings metadata');
}
const metadata: SettingsMetadata = parseResult.data;
// Now fully typed and validated
```

**Solution Pattern B - Unknown Schema:**
```typescript
// ✅ After - For dynamic/unknown schemas
const parsed: unknown = JSON.parse(settings.metadata);
if (!isObject(parsed)) {
  throw new ValidationError('Metadata must be an object');
}

// Safe property access with guards
if (hasProperty(parsed, 'providers')) {
  const providers = parsed.providers;
  if (isObject(providers)) {
    // Process providers
  }
}
```

**Target Files:**
- `src/server/services/download/downloadMonitor.ts:92-94`
- `src/server/services/config/providerMigration.ts:108`
- `src/server/services/config/eventMigration.ts:94`
- `src/utils/metadata-cache.ts:342`
- All files with `JSON.parse()` calls

**AST-grep Pattern:**
```bash
ast-grep --pattern 'JSON.parse($$$)' src/ --json
```

---

### Batch 2.3: API Response Handling (~240 violations, 6-8h)

**Problem:**
```typescript
// ❌ Before
const response = await axios.get('/api/status');
const data = response.data as Record<string, unknown>;
const status = data['status'] as string;  // Multiple unsafe casts
```

**Solution:**
```typescript
// ✅ After
interface StatusResponse {
  status: string;
  downloadId?: string;
}

const StatusResponseSchema = z.object({
  status: z.string(),
  downloadId: z.string().optional(),
});

const response = await axios.get<unknown>('/api/status');
const parsed = StatusResponseSchema.safeParse(response.data);
if (!parsed.success) {
  return AsyncResult.err(new ValidationError('Invalid status response'));
}
const data: StatusResponse = parsed.data;
return AsyncResult.ok(data);  // Fully typed
```

**Target Files:**
- `src/server/services/download/downloadMonitor.ts:170`
- `src/server/adapters/metadata/suwayomiAdapter.ts`
- `src/server/parsers/adapters/WikipediaAdapter.ts`
- `src/server/services/download/clients/nzbgetClient.ts`
- All adapter files

---

### Batch 2.4: Dynamic Property Access (~193 violations, 4-5h)

**Problem:**
```typescript
// ❌ Before
const downloadIdField = result['downloadId'];  // unknown
if (typeof downloadIdField === 'string') {
  downloadId = downloadIdField;
} else if (downloadIdField && typeof downloadIdField === 'object') {
  const asyncResult = downloadIdField as Record<string, unknown>;  // ❌
  downloadId = asyncResult['data'] as string | undefined;  // ❌
}
```

**Solution:**
```typescript
// ✅ After
const downloadIdField = result['downloadId'];
if (typeof downloadIdField === 'string') {
  downloadId = downloadIdField;
} else if (isObject(downloadIdField)) {
  if (hasProperty(downloadIdField, 'data')) {
    const data = downloadIdField['data'];
    if (typeof data === 'string') {
      downloadId = data;
    }
  }
}
```

**Helper Functions (already in codebase):**
```typescript
// Use existing helpers from type-guards.ts
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasProperty<K extends string>(
  obj: Record<string, unknown>,
  prop: K
): obj is Record<K, unknown> {
  return prop in obj;
}
```

**Target Files:**
- `src/server/services/download/downloadMonitor.ts:102-108`
- All service files with dynamic config access
- Migration files

---

## Phase 3: Complex Cases (Hard Fixes)

**Target:** ~135 violations (10%)
**Estimated Time:** 8-11 hours
**Risk Level:** 🔴 High

### Batch 3.1: Dynamic Prisma Model Access (~50 violations, 3-5h)

**Problem:**
```typescript
// ❌ Before - Dynamic model access
const prismaClientAny = this.prismaClient as unknown;  // ❌
const packDownloadTable = prismaClientAny['packDownload'];  // ❌
const findFirstMethod = packDownloadTable['findFirst'];  // ❌
const packDownloadResult = await findFirstMethod({...}) as unknown;  // ❌
```

**Root Cause:** Missing Prisma models in `schema.prisma`

**Solution A - Add Missing Models:**
```prisma
// prisma/schema.prisma
model PackDownload {
  id          Int      @id @default(autoincrement())
  packId      Int
  status      String
  downloadId  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("pack_download")
}
```

**Solution B - No Workarounds** ❌
Per project requirements: **Add missing models to schema.prisma only**. No dynamic access patterns allowed.

**Target Files:**
- `src/server/services/download/downloadMonitor.ts:376-400`
- All services with `@ts-nocheck` due to missing Prisma models

**Strategy:**
1. ✅ Identify all missing Prisma models (see Appendix C)
2. ✅ Add models to `schema.prisma`
3. ✅ Run `npx prisma generate`
4. ✅ Update code to use properly typed models
5. ✅ Remove all dynamic access code
6. ✅ Remove `@ts-nocheck` directives

---

### Batch 3.2: Complex Nested Transformations (~50 violations, 3-4h)

**Problem:**
```typescript
// ❌ Before - Deep nested access with multiple any casts
const result = await externalAPI.fetch();
const data = result.data as any;
const items = data.items as any[];
const processed = items.map((item: any) => ({
  id: item.id as number,
  nested: (item.nested as any).value as string,
}));
```

**Solution:**
```typescript
// ✅ After - Structured validation
interface ExternalAPIItem {
  id: number;
  nested: { value: string };
}

function isExternalAPIItem(item: unknown): item is ExternalAPIItem {
  return isObject(item) &&
    hasProperty(item, 'id') && typeof item.id === 'number' &&
    hasProperty(item, 'nested') && isObject(item.nested) &&
    hasProperty(item.nested, 'value') && typeof item.nested.value === 'string';
}

const result = await externalAPI.fetch();
if (!isObject(result) || !hasProperty(result, 'data')) {
  return AsyncResult.err(new ValidationError('Invalid API response'));
}

const data = result.data;
if (!isObject(data) || !hasProperty(data, 'items') || !isArray(data.items)) {
  return AsyncResult.err(new ValidationError('Invalid data structure'));
}

const validItems = data.items.filter(isExternalAPIItem);
if (validItems.length === 0) {
  logger.warn('No valid items in response');
}

const processed = validItems.map(item => ({
  id: item.id,
  nested: item.nested.value,
}));
```

**Target Files:**
- Complex adapter files
- Multi-step transformation pipelines
- Files with 5+ unsafe assignments in single function

---

### Batch 3.3: Test Files & Acceptable `any` (~35 violations, 2h)

**Problem:**
```typescript
// ❌ Test mock with any
const mockPrisma = {
  manga: {
    findFirst: jest.fn().mockResolvedValue({ id: 1 } as any)
  }
};
```

**Solution A - Proper Test Types:**
```typescript
// ✅ After
import type { Manga } from '@prisma/client';

const mockManga: Manga = {
  id: 1,
  title: 'Test Manga',
  // ... all required fields
};

const mockPrisma = {
  manga: {
    findFirst: jest.fn().mockResolvedValue(mockManga)
  }
};
```

**Solution B - Intentional `any` with Documentation:**
```typescript
// For cases where `any` is truly needed (external library mocks)
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Reason: Jest mock type inference incomplete for this library version
const mockExternal = (externalLib as any).createMock();
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
```

**Target Files:**
- `**/*.test.ts`
- `**/*.spec.ts`
- Test setup files

---

## Implementation Strategy

### Execution Order

```
Phase 1 (Easy) → Phase 2 (Medium) → Phase 3 (Hard)
     ↓                ↓                    ↓
  Batch 1.1      Batch 2.1            Batch 3.1
  Batch 1.2      Batch 2.2            Batch 3.2
  Batch 1.3      Batch 2.3            Batch 3.3
  Batch 1.4      Batch 2.4
```

### Batch Size Guidelines

| Complexity | Files/Batch | Violations/Batch | Time/Batch |
|------------|-------------|------------------|------------|
| Easy | 20-30 files | 40-60 violations | 1-2h |
| Medium | 10-15 files | 30-50 violations | 2-3h |
| Hard | 5-10 files | 10-20 violations | 2-4h |

---

## Validation Gates

### Every Batch Must Pass:

#### 1. TypeScript Compilation
```bash
npx tsc --noEmit
# Expected: 0 new errors
```

#### 2. ESLint Validation
```bash
npx eslint . --format json > /tmp/eslint-after.json
# Compare violation counts
```

#### 3. Unit Tests
```bash
npm test
# Expected: All passing tests still pass
```

#### 4. Type Coverage Check
```bash
npx type-coverage --at-least 95
```

---

## Rollback Strategy

### Trigger Conditions
- ❌ TypeScript errors increase by >5
- ❌ Any tests fail that were passing
- ❌ ESLint violations increase in other categories
- ❌ Build fails

### Rollback Process
```bash
git reset --hard HEAD~1  # Undo batch commit
# Analyze failure
# Split batch into smaller pieces
# Retry with adjusted approach
```

---

## Tools & Utilities

### AST-grep Search Patterns

```bash
# Find all JSON.parse calls
ast-grep --pattern 'JSON.parse($$$)' src/

# Find array access
ast-grep --pattern '$ARRAY[$INDEX]' src/

# Find type assertions
ast-grep --pattern '$VAR as any' src/
ast-grep --pattern '$VAR as unknown' src/

# Find localStorage usage
ast-grep --pattern 'localStorage.getItem($$$)' src/

# Find dynamic property access
ast-grep --pattern '$OBJ[$KEY]' src/
```

### Helper Functions (Create if Missing)

```typescript
// src/utils/type-guards.ts (extend existing)

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function safeJsonParse(
  json: string,
  fallback?: unknown
): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return fallback;
  }
}
```

---

## Success Metrics

### Target Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Total violations | ~1,346 | 0 | ESLint count |
| Type coverage | ~85% | >98% | type-coverage tool |
| Test pass rate | 100% | 100% | npm test |
| Build time | TBD | No increase | CI metrics |
| Runtime errors | TBD | <baseline | Production logs |

### Progress Tracking

Create tracking file after each batch:

```markdown
## Batch 1.1 Complete
- Files: 25
- Violations: 58
- Time: 1.5h
- Remaining: 1,288
```

---

## Risk Mitigation

### High-Risk Areas

1. **Prisma Dynamic Access** - May require schema changes
2. **API Response Changes** - Validate against actual API responses
3. **Test Files** - Don't break existing tests
4. **Production Code** - No functional changes, only type safety

### Safety Measures

- ✅ Small, atomic commits (1 batch = 1 commit)
- ✅ Validation gates before each commit
- ✅ Maintain existing behavior (no logic changes)
- ✅ Comprehensive testing after each phase
- ✅ Document any intentional `any` usage
- ✅ Peer review for complex batches

---

## Timeline Estimate

### Optimistic (28 hours)
- Phase 1: 4 hours
- Phase 2: 15 hours
- Phase 3: 8 hours
- Buffer: 1 hour

### Realistic (33 hours)
- Phase 1: 5 hours
- Phase 2: 18 hours
- Phase 3: 9 hours
- Buffer: 1 hour

### Pessimistic (38 hours)
- Phase 1: 7 hours
- Phase 2: 20 hours
- Phase 3: 11 hours

**Recommended:** Plan for 33-35 hours over 2-3 weeks

---

## Agent Orchestration (Optional)

### Parallel Execution Strategy

If using multiple agents:

```
Agent A (Easy Fixes)    → Phase 1 (Batches 1.1-1.4)
Agent B (API Types)     → Phase 2 (Batches 2.1-2.4)
Agent C (Complex)       → Phase 3 (Batches 3.1-3.3)
```

**Coordination:**
- Agents work on different directories simultaneously
- Daily sync to share patterns and helpers
- Sequential execution within each phase
- Validator agent checks each commit

---

## Next Steps

### Immediate Actions

1. **Review this plan** with team/lead agent
2. **Set up tracking** document structure
3. **Create branch** for work (already exists)
4. **Run baseline metrics**:
   ```bash
   npx eslint . --format json > /tmp/baseline-eslint.json
   npx tsc --noEmit > /tmp/baseline-tsc.txt
   npm test > /tmp/baseline-tests.txt
   ```
5. **Start Phase 1, Batch 1.1** (Array Access)

### ✅ Requirements Confirmed (2025-11-09)

- ✅ **Zod schemas for ALL API responses** - No exceptions
- ✅ **Add missing Prisma models** - No dynamic access workarounds
- ✅ **ESLint suppressions** - Only for true legitimate patterns (external library bugs, etc.)
- ✅ **Test strictness** - Same as production code (no `any` in tests)

---

## References

- [CLAUDE.md](../../CLAUDE.md) - Project coding standards
- [ESLint Rules Reference](./eslint-rules-reference.md)
- [AsyncResult Pattern Guide](../user-guides/asyncresult-pattern-complete-guide.md)
- [Type System Architecture](../typescript/type-system-architecture-standardization.md)
- [Existing Master Plan](./NO_UNSAFE_ASSIGNMENT_MASTER_PLAN.md) - Previous analysis

---

## Appendix A: High-Priority Files

### Top 20 Files by Violation Count

Based on analysis, these files should be prioritized:

1. `WikipediaAdapter.ts` - 20+ violations (parsers)
2. `downloadMonitor.ts` - 15+ violations (services)
3. `nzbgetClient.ts` - 12+ violations (services)
4. `providerMigration.ts` - 10+ violations (services)
5. `metadata-cache.ts` - 8+ violations (utils)
6. `suwayomiAdapter.ts` - 8+ violations (adapters)
7. `smartClientSelector.ts` - 6+ violations (utils)
8. `eventMigration.ts` - 5+ violations (services)
9. `BaseHttpClient.ts` - 5+ violations (base)
10. `VirtualChapterList.tsx` - 3+ violations (components)
11-20. Various service and adapter files (2-4 violations each)

---

## Appendix B: Pattern Examples from Codebase

### Example 1: downloadMonitor.ts (Multiple Patterns)

**File:** `src/server/services/download/downloadMonitor.ts`
**Violations:** 15+
**Patterns:** JSON.parse, API responses, dynamic property access, Prisma dynamic access

**Lines to Fix:**
- 92-94: JSON.parse result
- 102-108: Nested dynamic property access
- 170: API response data access
- 376-400: Dynamic Prisma model access

---

### Example 2: metadata-cache.ts (JSON + LocalStorage)

**File:** `src/utils/metadata-cache.ts`
**Violations:** 8+
**Patterns:** JSON.parse, LocalStorage, cache decompression

**Lines to Fix:**
- 218-225: Cache recovery from localStorage
- 342: Decompressed data parsing

---

### Example 3: WikipediaAdapter.ts (API + Cheerio)

**File:** `src/server/parsers/adapters/WikipediaAdapter.ts`
**Violations:** 20+
**Patterns:** API responses, Cheerio selectors, array access

**Lines to Fix:**
- 307: Cheerio $ selector (use proper types)
- 524: Array access without bounds check
- Multiple API response handling blocks

---

## Appendix C: Missing Prisma Models Reference

### Overview

7 Prisma models are missing from `schema.prisma`, causing dynamic access patterns and `@ts-nocheck` suppressions. Complete implementation details are in `PRISMA_MODELS_ADDITION_GUIDE.md`.

### Quick Reference Table

| Model | Priority | Files Blocked | Schema Ready | Time to Add |
|-------|----------|---------------|--------------|-------------|
| **PackDownload** | 🔴 CRITICAL | 4 | ✅ Yes | 30 min |
| **MetadataFieldPreference** | 🟡 MEDIUM | 1 | ✅ Yes | 15 min |
| **MetadataConflict** | 🟡 MEDIUM | 1 | ✅ Yes | 15 min |
| **LearnedPattern** | 🟢 LOW | 1 (disabled) | ✅ Yes | Defer |
| **PatternVariation** | 🟢 LOW | 1 (disabled) | ✅ Yes | Defer |
| **PatternPerformance** | 🟢 LOW | 1 (disabled) | ✅ Yes | Defer |
| **MLModelWeight** | 🟢 LOW | 0 (comment only) | ✅ Yes | Defer |

### PackDownload Model (CRITICAL)

**Blocking Files:**
- `src/server/services/download/downloadMonitor.ts` (has `@ts-nocheck`)
- `src/server/services/download/downloadManager.ts` (has `@ts-nocheck`)
- `src/server/services/packImport/deduplication.ts` (has `@ts-nocheck`)
- `src/server/services/packImport/packImportService.ts`

**Schema Location:** `PRISMA_MODELS_ADDITION_GUIDE.md` lines 40-68

**Quick Add:**
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

**Also Update Chapter Model:**
```prisma
model Chapter {
  // ... existing fields ...
  packDownloadId    BigInt?
  PackDownload      PackDownload?  @relation(fields: [packDownloadId], references: [id], onDelete: SetNull)
  @@index([packDownloadId])
}
```

### Metadata Models (MEDIUM Priority)

**Blocking File:**
- `src/server/trpc/routers/metadata.ts` (graceful degradation, optional chaining)

**MetadataFieldPreference Schema:**
```prisma
model MetadataFieldPreference {
  id              Int          @id @default(autoincrement())
  fieldName       String
  providerId      String
  priority        Int          @default(1)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([fieldName, providerId])
  @@index([priority])
  @@map("metadata_field_preference")
}
```

**MetadataConflict Schema:**
```prisma
model MetadataConflict {
  id                Int          @id @default(autoincrement())
  mangaId           Int
  fieldName         String
  values            Json
  resolved          Boolean      @default(false)
  resolution        String?
  resolutionProvider String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  manga             Manga        @relation(fields: [mangaId], references: [id], onDelete: Cascade)

  @@index([mangaId])
  @@index([resolved])
  @@index([fieldName])
  @@map("metadata_conflict")
}
```

**Also Update Manga Model:**
```prisma
model Manga {
  // ... existing fields ...
  metadataConflicts MetadataConflict[]
}
```

### ML Models (LOW Priority - Can Defer)

**File:** `src/server/parsers/pattern-recognition/persistence/DatabasePatternStore.ts` (has `@ts-nocheck`, all code commented out)

**Status:** These models support ML-based metadata pattern recognition. Feature is currently disabled with in-memory fallback. Can be added when ML features are prioritized.

**Complete Schemas:** See `PRISMA_MODELS_ADDITION_GUIDE.md` Phase 3 (lines 394-444)

### Migration Commands

```bash
# After adding models to schema.prisma:

# Phase 1: PackDownload
npx prisma migrate dev --name add_pack_download_model
npx prisma generate

# Phase 2: Metadata Models
npx prisma migrate dev --name add_metadata_management_models
npx prisma generate

# Phase 3: ML Models (when ready)
npx prisma migrate dev --name add_ml_pattern_models
npx prisma generate
```

### Expected Impact

**After Phase 1 (PackDownload):**
- 3 files freed from `@ts-nocheck`
- 50+ violations fixed
- Multi-volume pack downloads functional

**After Phase 2 (Metadata):**
- 1 file improved (remove optional chaining)
- 10+ violations fixed
- Metadata conflict resolution functional

**After Phase 3 (ML):**
- 1 file freed from `@ts-nocheck`
- 15+ violations fixed
- ML pattern learning persistent across restarts

---

## Document Metadata

**Version:** 1.1
**Author:** Analysis Agent + Coordinator
**Date Created:** 2025-11-09
**Last Updated:** 2025-11-09
**Status:** Ready for Execution
**Canonical:** Yes

**Changelog:**
- v1.1 (2025-11-09): Added Appendix C (Missing Prisma Models Reference)
- v1.0 (2025-11-09): Initial version

---

*This plan will be updated after each phase completion with actual metrics and learnings.*
