# Wave 5-6 Analysis Report: Dynamic Access & Complex Edge Cases

*Analyzer: Analyzer-C*
*Date: 2025-11-08*
*Branch: `claude/scan-eslint-unsafe-assignment-011CUv1Dqtq5e4vn5RZS55MX`*
*Status: Analysis Complete*

---

## Executive Summary

Wave 5-6 addresses the most complex and risky violations in the codebase:
- **Dynamic property access**: ~688 violations
- **Third-party integration**: ~68 violations
- **Complex edge cases**: ~20 violations

**Total Estimated Violations**: 776 (12.9% of total)
**Risk Level**: 🔴 **CRITICAL**
**Complexity**: **HIGH**
**Estimated Effort**: 12-16 hours

---

## Violation Breakdown

### By Pattern Type

| Pattern | Count | % of Wave | Risk | Complexity |
|---------|-------|-----------|------|------------|
| **Metadata bracket access** | 560 | 72.2% | 🔴 High | High |
| **Config bracket access** | 82 | 10.6% | 🟡 Medium | Medium |
| **Response bracket access** | 63 | 8.1% | 🟡 Medium | Medium |
| **Error handling (as any)** | 47 | 6.1% | 🟡 Medium | Low |
| **Record<string, any>** | 14 | 1.8% | 🔴 High | Medium |
| **Prisma dynamic access** | 9 | 1.2% | 🔴 High | High |
| **Third-party integration** | 1 | <1% | 🟢 Low | Low |
| **TOTAL** | **776** | **100%** | | |

### By Risk Level

| Risk | Count | % | Description |
|------|-------|---|-------------|
| 🔴 **Critical** | 583 | 75.1% | Runtime key access, potential runtime errors |
| 🟡 **Medium** | 192 | 24.7% | Constrained keys, validation possible |
| 🟢 **Low** | 1 | 0.1% | Compile-time known, safe to fix |

---

## Pattern Analysis

### 1. Metadata Bracket Access (560 violations - 72.2%)

**Risk Level**: 🔴 Critical

#### Pattern Description
Dynamic access to metadata objects using runtime keys, primarily in provider selection and field mapping logic.

#### Examples

**File**: `src/pages/manga/[id].tsx`
```typescript
// Line 637-645 - Runtime field selection
const getFieldFromSelectedProvider = (fieldName: string, defaultValue: unknown = null) => {
    const selectedProvider = selectedSources[fieldName];  // 🔴 Dynamic key
    if (!selectedProvider || selectedProvider === 'none') return defaultValue;

    const providerData = (providerMeta as any)[selectedProvider];  // 🔴 Dynamic key + as any
    if (!providerData) return defaultValue;

    const metadata = providerData?.Metadata ?? providerData;
    return metadata[fieldName] ?? defaultValue;  // 🔴 Dynamic key
};
```

**File**: `src/pages/manga/[id].tsx` (Line 720, 730)
```typescript
genres = Array.isArray(metadata["genres"]) ? metadata["genres"] : [];  // 🔴 String literal key
authors = Array.isArray(metadata["authors"]) ? (metadata["authors"] as string[]) : [];  // 🔴 String literal key
```

**File**: `src/components/manga/MangaMetadataEditor.tsx` (Line 95, 114)
```typescript
const correctedData = { ...manga, [field]: value };  // 🔴 Computed property
corrections: { [field]: { from: (manga as any)[field], to: value } }  // 🔴 Dynamic + as any
```

#### Subcategories

| Subcategory | Count | Risk | Example File |
|-------------|-------|------|--------------|
| Provider field selection | ~200 | 🔴 Critical | `manga/[id].tsx`, `addManga/UniversalImportWizard.tsx` |
| String literal keys | ~250 | 🟡 Medium | `manga/[id].tsx`, `metadata-field-mapping.ts` |
| Computed properties | ~110 | 🔴 Critical | `MangaMetadataEditor.tsx`, `ProviderSearchModal.tsx` |

#### Root Causes
1. **Provider flexibility**: System supports multiple metadata providers with different field structures
2. **Dynamic field mapping**: User can select which provider to use for each field
3. **Legacy data structures**: Some metadata stored as `Record<string, unknown>`
4. **Adapter pattern**: Universal adapters need to handle arbitrary provider schemas

#### Suggested Approaches

**Strategy 1: Type Narrowing with Known Fields**
```typescript
// ✅ For compile-time known fields
type MetadataField = 'title' | 'authors' | 'genres' | 'description' | 'status';
type MetadataMap = {
    title: string;
    authors: string[];
    genres: string[];
    description: string;
    status: MangaPublicationStatus;
};

function getMetadataField<K extends MetadataField>(
    metadata: Record<string, unknown>,
    field: K
): MetadataMap[K] | undefined {
    return metadata[field] as MetadataMap[K];
}
```

**Strategy 2: Zod Schema Validation**
```typescript
// ✅ For runtime validation
import { z } from 'zod';

const MetadataSchema = z.object({
    title: z.string().optional(),
    authors: z.array(z.string()).optional(),
    genres: z.array(z.string()).optional(),
    // ... other fields
}).passthrough();

type ValidatedMetadata = z.infer<typeof MetadataSchema>;

function safeGetMetadata(raw: unknown): ValidatedMetadata {
    return MetadataSchema.parse(raw);
}
```

**Strategy 3: Type Guards for Dynamic Keys**
```typescript
// ✅ For truly dynamic scenarios
function isValidMetadataKey(key: string): key is keyof ValidatedMetadata {
    return ['title', 'authors', 'genres', /* ... */].includes(key);
}

function getDynamicField(metadata: Record<string, unknown>, key: string): unknown {
    if (!isValidMetadataKey(key)) {
        throw new Error(`Invalid metadata key: ${key}`);
    }
    return metadata[key];
}
```

**Strategy 4: Branded Types for Provider Keys**
```typescript
// ✅ For provider selection
type ProviderKey = 'anilist' | 'comicvine' | 'fandom' | 'wikipedia' | 'suwayomi';
type ProviderMetadata = Record<ProviderKey, MetadataPayload>;

function getProviderData(
    providers: ProviderMetadata,
    provider: ProviderKey
): MetadataPayload {
    return providers[provider];
}
```

---

### 2. Config Bracket Access (82 violations - 10.6%)

**Risk Level**: 🟡 Medium

#### Pattern Description
Configuration objects accessed with bracket notation, often from user input or API responses.

#### Examples

**File**: `src/components/settings/suwayomi/SuwayomiSecuritySettings.tsx` (Line 149)
```typescript
setConfig((prev) => ({ ...prev, [key]: value }));  // 🟡 Dynamic key from state
```

**File**: `src/components/settings/FieldProviderPreferences.tsx` (Line 100)
```typescript
{ [field]: providers }  // 🟡 Computed property
```

**File**: `src/pages/jobs/conversion.tsx` (Line 129)
```typescript
const statusConfig = config[status] || config.PENDING;  // 🟡 Enum-like access
```

#### Subcategories

| Subcategory | Count | Risk | Example |
|-------------|-------|------|---------|
| Settings updates | ~40 | 🟡 Medium | Component state setters |
| Status/enum lookup | ~30 | 🟢 Low | Known set of keys |
| Dynamic config | ~12 | 🔴 High | User-provided keys |

#### Suggested Approaches

**For Known Config Keys**:
```typescript
// ✅ Define config type
type ConfigKey = 'enabled' | 'apiKey' | 'baseUrl' | 'timeout';
type Config = Record<ConfigKey, string | boolean | number>;

function updateConfig<K extends ConfigKey>(
    config: Config,
    key: K,
    value: Config[K]
): Config {
    return { ...config, [key]: value };
}
```

**For Status Lookups**:
```typescript
// ✅ Use const assertion
const STATUS_CONFIG = {
    PENDING: { color: 'gray', icon: IconClock },
    ACTIVE: { color: 'blue', icon: IconPlayerPlay },
    COMPLETED: { color: 'green', icon: IconCheck },
    FAILED: { color: 'red', icon: IconX }
} as const;

type Status = keyof typeof STATUS_CONFIG;

function getStatusConfig(status: Status) {
    return STATUS_CONFIG[status];
}
```

---

### 3. Response Bracket Access (63 violations - 8.1%)

**Risk Level**: 🟡 Medium

#### Pattern Description
HTTP response objects accessed with bracket notation for status codes, headers, and data.

#### Examples

**File**: `src/pages/api-playground.tsx` (Line 427, 443, 661-668)
```typescript
status: response["status"],  // 🟡 Known property
message: `Request failed with status ${response["status"]}`,
typeof response['status'] === 'number' && response['status'] >= 200  // 🟡 Type check + access
```

**File**: `src/pages/api/proxy/transmission.ts` (Line 96-112)
```typescript
if (response["status"] === 409) {  // 🟡 Known status code
    logger.error('Transmission error:', response["status"], response.data);
    return res["status"](response["status"]).json({ /* ... */ });
}
```

#### Subcategories

| Subcategory | Count | Risk | Example |
|-------------|-------|------|---------|
| HTTP status codes | ~40 | 🟢 Low | `response["status"]` |
| Response data | ~15 | 🟡 Medium | `response["data"]` |
| Headers access | ~8 | 🟡 Medium | `response["headers"]` |

#### Suggested Approaches

**Strategy: Type Response Objects**
```typescript
// ✅ Define response type
interface HttpResponse<T = unknown> {
    status: number;
    statusText: string;
    data: T;
    headers: Record<string, string>;
    time?: number;
}

// Use typed response
function handleResponse<T>(response: HttpResponse<T>): void {
    if (response.status >= 200 && response.status < 300) {
        console.log(response.data);
    }
}
```

**Strategy: Axios Response Types**
```typescript
// ✅ Use Axios types
import type { AxiosResponse } from 'axios';

function processResponse(response: AxiosResponse): void {
    // TypeScript knows all properties
    const { status, data, headers } = response;
}
```

---

### 4. Error Handling (47 violations - 6.1%)

**Risk Level**: 🟡 Medium

#### Pattern Description
Error objects cast to `any` to access vendor-specific properties like `code`, `status`, `response`.

#### Examples

**File**: `src/server/utils/retry.ts` (Line 107-110, 118, 129)
```typescript
return (error as any)['status'] ||
       (error as any)['response']?.['status'] ||
       (error as any)['statusCode'] ||
       (error as any)['response']?.['statusCode'];
```

**File**: `src/server/utils/log-sanitizer.ts` (Line 119, 252)
```typescript
code: (data as any).code,  // 🟡 Error code
code: (error as any).code,
```

#### Suggested Approaches

**Strategy: Type Guards for Known Error Types**
```typescript
// ✅ Define error type guards
interface NodeError extends Error {
    code?: string;
}

interface HttpError extends Error {
    status?: number;
    statusCode?: number;
    response?: {
        status?: number;
        statusCode?: number;
    };
}

function isHttpError(error: unknown): error is HttpError {
    return (
        error instanceof Error &&
        ('status' in error || 'statusCode' in error || 'response' in error)
    );
}

function getErrorStatus(error: unknown): number | undefined {
    if (!isHttpError(error)) return undefined;

    return error.status ||
           error.response?.status ||
           error.statusCode ||
           error.response?.statusCode;
}
```

**Strategy: Discriminated Union**
```typescript
// ✅ Use discriminated unions
type AppError =
    | { type: 'network'; status: number; message: string }
    | { type: 'validation'; field: string; message: string }
    | { type: 'unknown'; error: Error };

function handleError(error: AppError): void {
    switch (error.type) {
        case 'network':
            console.log(`HTTP ${error.status}: ${error.message}`);
            break;
        case 'validation':
            console.log(`Invalid ${error.field}: ${error.message}`);
            break;
        case 'unknown':
            console.log(error.error.message);
            break;
    }
}
```

---

### 5. Record<string, any> (14 violations - 1.8%)

**Risk Level**: 🔴 Critical

#### Pattern Description
Objects typed as `Record<string, any>` that need to be replaced with proper types or `unknown`.

#### Locations

| File | Line | Current Type | Risk |
|------|------|-------------|------|
| `server/trpc/routers/library.ts` | 213 | `Record<string, any>` | 🔴 High |
| `server/trpc/routers/system.ts` | 211, 375, 947 | `Record<string, any>` | 🔴 High |
| `server/trpc/routers/metadata.ts` | 2526, 2664, 2715 | `Record<string, any>` | 🔴 High |
| `server/utils/log-sanitizer.ts` | 131, 169, 174, 218, 247 | `Record<string, any>` | 🔴 High |
| `server/services/eventEmitter.ts` | 204 | `Record<string, any>` | 🔴 High |

#### Suggested Approach

**Step 1: Replace with `unknown`**
```typescript
// ❌ Before
const data: Record<string, any> = {};

// ✅ After
const data: Record<string, unknown> = {};
```

**Step 2: Add Type Guards**
```typescript
// ✅ Validate before use
function isValidData(data: Record<string, unknown>): data is ValidDataType {
    return (
        typeof data.field1 === 'string' &&
        typeof data.field2 === 'number'
    );
}

if (isValidData(data)) {
    // TypeScript now knows data.field1 is string
}
```

**Step 3: Use Zod for Complex Validation**
```typescript
// ✅ Runtime validation with Zod
const DataSchema = z.record(z.string(), z.unknown());
const parsed = DataSchema.parse(data);
```

---

### 6. Prisma Dynamic Access (9 violations - 1.2%)

**Risk Level**: 🔴 Critical

#### Pattern Description
Dynamic access to Prisma client models using bracket notation, used in generic batch query utilities.

#### Examples

**File**: `src/server/utils/batchQuery.ts` (Line 104, 204, 274, 336)
```typescript
const modelClient = this.prisma[model] as any;  // 🔴 Critical: Dynamic model + as any

if (modelClient.createMany) {
    const result = await modelClient.createMany({ /* ... */ });
}
```

**File**: `src/server/utils/query-optimizer.ts` (Line 64, 72, 102, 138, 206)
```typescript
(prisma[model] as any).findMany({ /* ... */ })  // 🔴 Critical
(prisma[model] as any).count({ where })
(prisma[model] as any).groupBy({ /* ... */ })
```

#### Root Cause
Generic utilities that work across all Prisma models need dynamic access since model names are runtime strings.

#### Suggested Approaches

**Strategy 1: Typed Model Union**
```typescript
// ✅ Define all Prisma models
type PrismaModel =
    | 'manga'
    | 'chapter'
    | 'library'
    | 'user'
    | 'metadata'
    // ... all 40+ models

type PrismaDelegate<M extends PrismaModel> =
    M extends 'manga' ? typeof prisma.manga :
    M extends 'chapter' ? typeof prisma.chapter :
    M extends 'library' ? typeof prisma.library :
    // ... all models
    never;

function getPrismaModel<M extends PrismaModel>(
    prisma: PrismaClient,
    model: M
): PrismaDelegate<M> {
    return prisma[model] as PrismaDelegate<M>;
}
```

**Strategy 2: Runtime Validation**
```typescript
// ✅ Validate model name at runtime
const VALID_MODELS = [
    'manga', 'chapter', 'library', /* ... */
] as const;

type ValidModel = typeof VALID_MODELS[number];

function isValidModel(model: string): model is ValidModel {
    return VALID_MODELS.includes(model as ValidModel);
}

function batchCreate<T>(model: string, data: T[]): Promise<unknown> {
    if (!isValidModel(model)) {
        throw new Error(`Invalid Prisma model: ${model}`);
    }

    const modelClient = prisma[model];
    return modelClient.createMany({ data });
}
```

**Strategy 3: Model-Specific Overloads**
```typescript
// ✅ Provide overloads for common models
function batchQuery(model: 'manga', query: MangaQuery): Promise<Manga[]>;
function batchQuery(model: 'chapter', query: ChapterQuery): Promise<Chapter[]>;
function batchQuery(model: string, query: unknown): Promise<unknown[]>;
function batchQuery(model: string, query: unknown): Promise<unknown[]> {
    // Implementation
}
```

---

### 7. Third-Party Integration (1 violation - <1%)

**Risk Level**: 🟢 Low

#### Pattern Description
Type assertions for third-party libraries without proper TypeScript types.

#### Example

**File**: `src/lib/auth/config.mock.ts` (Line 62)
```typescript
adapter: MockPrismaAdapter() as any,  // 🟢 Test file, low risk
```

#### Suggested Approach
```typescript
// ✅ Create proper type wrapper
import type { Adapter } from 'next-auth/adapters';

function MockPrismaAdapter(): Adapter {
    return {
        // Implement adapter interface
    } as Adapter;
}
```

---

## Batch Execution Plan

### Wave 5: Dynamic Access Patterns

#### Batch 5.1: String Literal Keys (Low Risk)
**Count**: ~250 violations
**Risk**: 🟡 Medium
**Files**: 15-20 files
**Strategy**: Replace string literals with dot notation or typed accessors

**Example Files**:
- `src/pages/manga/[id].tsx` (high concentration)
- `src/components/addManga/form.tsx`
- `src/components/manga/StandardMangaList.tsx`

**Batching**:
- Batch 5.1.1: manga/[id].tsx metadata access (50-60 violations)
- Batch 5.1.2: addManga components (40-50 violations)
- Batch 5.1.3: Other component string literals (30-40 violations)
- Batch 5.1.4-5.1.12: Remaining files (10-20 violations each)

#### Batch 5.2: Config & Settings (Medium Risk)
**Count**: ~82 violations
**Risk**: 🟡 Medium
**Files**: 10-15 files
**Strategy**: Define config types and use type-safe setters

**Example Files**:
- `src/components/settings/suwayomi/*.tsx`
- `src/components/settings/FieldProviderPreferences.tsx`
- `src/pages/jobs/*.tsx`

**Batching**:
- Batch 5.2.1: Suwayomi settings (20-25 violations)
- Batch 5.2.2: Provider preferences (15-20 violations)
- Batch 5.2.3: Jobs/status config (20-25 violations)
- Batch 5.2.4-5.2.6: Remaining config files (10-15 violations each)

#### Batch 5.3: Response Handling (Medium Risk)
**Count**: ~63 violations
**Risk**: 🟡 Medium
**Files**: 8-12 files
**Strategy**: Type HTTP responses properly

**Example Files**:
- `src/pages/api-playground.tsx`
- `src/pages/api/proxy/*.ts`
- `src/server/utils/httpClient.ts`

**Batching**:
- Batch 5.3.1: API playground (20-25 violations)
- Batch 5.3.2: Proxy endpoints (15-20 violations)
- Batch 5.3.3: HTTP client utils (10-15 violations)
- Batch 5.3.4: Remaining response handling (10-15 violations)

#### Batch 5.4: Error Handling (Low Risk)
**Count**: ~47 violations
**Risk**: 🟡 Medium
**Files**: 5-8 files
**Strategy**: Create error type guards

**Example Files**:
- `src/server/utils/retry.ts`
- `src/server/utils/rateLimit.ts`
- `src/server/utils/log-sanitizer.ts`

**Batching**:
- Batch 5.4.1: Retry logic (15-20 violations)
- Batch 5.4.2: Rate limiting (10-15 violations)
- Batch 5.4.3: Log sanitization (10-12 violations)
- Batch 5.4.4: Remaining error handling (5-10 violations)

#### Batch 5.5: Provider Field Selection (High Risk) 🔴
**Count**: ~200 violations
**Risk**: 🔴 Critical
**Files**: 5-8 files
**Strategy**: Create type-safe provider selection system

**Example Files**:
- `src/pages/manga/[id].tsx` (getFieldFromSelectedProvider)
- `src/components/addManga/UniversalImportWizard.tsx`
- `src/components/manga/ProviderSearchModal.tsx`

**Batching**:
- Batch 5.5.1: Define provider field types (setup)
- Batch 5.5.2: manga/[id].tsx provider logic (80-100 violations)
- Batch 5.5.3: UniversalImportWizard (60-80 violations)
- Batch 5.5.4-5.5.6: Provider components (15-20 violations each)

**CRITICAL**: This batch requires careful testing as it affects core metadata functionality.

#### Batch 5.6: Computed Properties (High Risk) 🔴
**Count**: ~110 violations
**Risk**: 🔴 Critical
**Files**: 8-12 files
**Strategy**: Add type constraints and validation

**Example Files**:
- `src/components/manga/MangaMetadataEditor.tsx`
- `src/components/settings/FieldProviderPreferences.tsx`
- State setters across multiple components

**Batching**:
- Batch 5.6.1: Metadata editor (25-30 violations)
- Batch 5.6.2: Field preferences (20-25 violations)
- Batch 5.6.3-5.6.6: State setters (15-20 violations each)

---

### Wave 6: Critical Infrastructure

#### Batch 6.1: Record<string, any> (Critical) 🔴
**Count**: 14 violations
**Risk**: 🔴 Critical
**Files**: 3 files
**Strategy**: Replace with `unknown` and add validation

**Batching**:
- Batch 6.1.1: log-sanitizer.ts (5 violations)
- Batch 6.1.2: tRPC routers (8 violations)
- Batch 6.1.3: eventEmitter.ts (1 violation)

**Testing**: Unit tests required for each change.

#### Batch 6.2: Prisma Dynamic Access (Critical) 🔴
**Count**: 9 violations
**Risk**: 🔴 Critical
**Files**: 2 files
**Strategy**: Create type-safe Prisma model access

**Files**:
- `src/server/utils/batchQuery.ts` (4 violations)
- `src/server/utils/query-optimizer.ts` (5 violations)

**Batching**:
- Batch 6.2.1: Create PrismaModel type and guards (setup)
- Batch 6.2.2: batchQuery.ts refactor (4 violations)
- Batch 6.2.3: query-optimizer.ts refactor (5 violations)

**CRITICAL**: Integration tests required. Affects database operations across entire app.

#### Batch 6.3: Third-Party & Edge Cases (Low Risk)
**Count**: ~21 violations
**Risk**: 🟢 Low
**Files**: 2-3 files
**Strategy**: Add type wrappers or document intentional `any`

**Batching**:
- Batch 6.3.1: Test mocks and adapters (1-5 violations)
- Batch 6.3.2: Manual review items (flagged for human review)

---

## Risk Assessment by File

### High-Risk Files (🔴 Requires Extra Care)

| File | Violations | Risk Factors |
|------|-----------|--------------|
| `src/pages/manga/[id].tsx` | ~150 | Core manga display, provider selection logic |
| `src/components/addManga/UniversalImportWizard.tsx` | ~80 | Complex wizard, field selection |
| `src/server/utils/batchQuery.ts` | 4 | Database batch operations |
| `src/server/utils/query-optimizer.ts` | 5 | Query performance optimization |
| `src/components/manga/MangaMetadataEditor.tsx` | ~30 | Metadata editing, user corrections |

### Medium-Risk Files (🟡 Standard Approach)

| File | Violations | Notes |
|------|-----------|-------|
| `src/pages/api-playground.tsx` | ~30 | API testing tool |
| `src/server/utils/retry.ts` | ~15 | Error handling utility |
| `src/components/settings/suwayomi/*.tsx` | ~40 | Settings management |

### Low-Risk Files (🟢 Quick Fixes)

| File | Violations | Notes |
|------|-----------|-------|
| `src/lib/auth/config.mock.ts` | 1 | Test file |
| Various status config lookups | ~30 | Known enum keys |

---

## Testing Strategy

### Unit Tests Required

1. **Provider field selection** (`manga/[id].tsx`)
   - Test getFieldFromSelectedProvider with all providers
   - Verify fallback to defaults
   - Test with missing/invalid providers

2. **Prisma dynamic access** (`batchQuery.ts`, `query-optimizer.ts`)
   - Test all model types
   - Verify error handling for invalid models
   - Performance regression tests

3. **Type guards**
   - Test all new type guard functions
   - Verify edge cases and null/undefined handling

### Integration Tests Required

1. **Metadata display** - Verify manga detail page renders correctly
2. **Provider selection** - Test selecting different providers for different fields
3. **Batch operations** - Test bulk manga operations still work
4. **Error handling** - Verify errors are properly typed and handled

### Manual Testing Checklist

- [ ] Manga detail page displays all metadata correctly
- [ ] Provider selection in Universal Import Wizard works
- [ ] Metadata editor can update fields
- [ ] Settings pages load and save correctly
- [ ] API playground functions properly
- [ ] Error messages are clear and helpful
- [ ] No console errors in browser
- [ ] Database operations complete successfully

---

## Implementation Guidelines

### General Principles

1. **Prefer type narrowing over type guards** when possible
2. **Use Zod for runtime validation** of external data
3. **Document intentional dynamic access** with comments
4. **Add JSDoc** for complex type transformations
5. **Maintain backwards compatibility** where possible

### Code Patterns to Follow

#### ✅ Good: Type-safe accessor
```typescript
type MetadataKey = 'title' | 'authors' | 'genres';
function getMetadata<K extends MetadataKey>(
    data: Record<string, unknown>,
    key: K
): unknown {
    return data[key];
}
```

#### ✅ Good: Runtime validation
```typescript
const validKeys = ['title', 'authors', 'genres'] as const;
if (!validKeys.includes(key)) {
    throw new Error(`Invalid key: ${key}`);
}
```

#### ❌ Bad: Unconstrained dynamic access
```typescript
function getData(obj: any, key: string) {
    return obj[key];  // No validation or typing
}
```

### Migration Path

1. **Phase 1**: Low-risk batches (5.1-5.4) - Build confidence
2. **Phase 2**: Medium-risk batches (5.5-5.6) - Core functionality
3. **Phase 3**: Critical batches (6.1-6.2) - Infrastructure
4. **Phase 4**: Manual review (6.3) - Edge cases

---

## Known Issues & Gotchas

### Issue 1: Provider Metadata Polymorphism
**Problem**: Different providers return different metadata shapes.
**Impact**: Cannot create single unified type.
**Solution**: Use discriminated unions or Zod schemas per provider.

### Issue 2: Prisma Model Type Safety
**Problem**: Prisma client doesn't export model union type.
**Impact**: Cannot type `prisma[model]` without manual maintenance.
**Solution**: Generate model union from `schema.prisma` or accept `as` cast with validation.

### Issue 3: Legacy Data Migration
**Problem**: Existing database may have metadata in old format.
**Impact**: Runtime errors if we're too strict with types.
**Solution**: Add migration script or graceful fallbacks.

### Issue 4: User-Defined Fields
**Problem**: Some systems allow user to add custom metadata fields.
**Impact**: Cannot have exhaustive field list.
**Solution**: Separate "known fields" (typed) from "custom fields" (Record<string, unknown>).

---

## Metrics & Success Criteria

### Definition of Done

- [ ] All 776 violations fixed
- [ ] Zero new `@typescript-eslint/no-unsafe-assignment` errors
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing checklist complete
- [ ] Code review approved
- [ ] Documentation updated

### Performance Targets

- [ ] No degradation in page load times
- [ ] No degradation in database query performance
- [ ] Bundle size increase <5KB

### Type Safety Metrics

- [ ] 0 uses of `Record<string, any>`
- [ ] 95%+ reduction in `as any` casts
- [ ] All dynamic access has validation or type narrowing
- [ ] IntelliSense works for all metadata fields

---

## Escalation & Manual Review

### Items Requiring Human Review

1. **Custom provider integration** - May need product decision on type safety vs. flexibility
2. **Performance-critical code** - Benchmark before/after changes
3. **Complex generic utilities** - May need TypeScript expert review

### Escalation Triggers

- Violation count significantly higher than estimate
- Breaking change required to fix properly
- Ambiguous business logic discovered
- Type safety vs. runtime flexibility tradeoff

---

## Appendix

### A. File Inventory

Complete list of files by batch available in `batch-plan.json`.

### B. Type Guard Templates

See `type-guards.ts` for reusable type guard patterns.

### C. Testing Utilities

See `wave5-6/test-helpers.ts` for testing utilities (to be created during execution).

---

*Analysis completed by Analyzer-C on 2025-11-08*
*Report version: 1.0*
*Next: Execute batches sequentially with validation gates*
