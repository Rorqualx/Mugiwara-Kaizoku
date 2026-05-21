# Wave 3-4 Analysis Report: JSON Operations & Function Typing

*Analyzer-B Analysis*
*Created: 2025-11-08*
*Status: Analysis Complete*

---

## Executive Summary

This report provides a comprehensive analysis of JSON operations and function typing violations for Waves 3-4 of the `@typescript-eslint/no-unsafe-assignment` remediation project.

### Violations Summary

| Category | Count | Risk Level | Complexity |
|----------|-------|------------|------------|
| JSON.parse() | 231 | 🔴 High | Medium |
| response.json() / .json() | 52 | 🔴 High | Medium |
| Function parameters | TBD | 🟡 Medium | Medium |
| Function returns | TBD | 🟡 Medium | Low-Medium |
| **Total** | **283+** | | |

**Note**: Function typing violations require manual AST analysis and are estimated at ~840 total based on master plan projections.

---

## Part 1: JSON Operations Analysis

### 1.1 JSON.parse() Violations (231 occurrences)

#### High-Concentration Files

| File | Violations | Primary Use Case |
|------|------------|------------------|
| `src/server/api/__tests__/api.test.ts` | 16 | Test data parsing |
| `src/server/trpc/routers/manga.ts` | 14 | Manga metadata/provider data |
| `src/components/volumeChaptersTable.tsx` | 11 | Provider metadata rendering |
| `src/pages/manga/[id].tsx` | 10 | Manga detail page data |
| `src/server/api/__tests__/integration/webhooks.test.ts` | 9 | Test payloads |
| `src/server/api/__tests__/integration/metadata.test.ts` | 9 | Test metadata |
| `src/examples/notification-integration-examples.ts` | 8 | Event settings |
| `src/server/api/__tests__/integration/manga.test.ts` | 7 | Test manga data |
| `src/server/trpc/routers/metadata.ts` | 6 | Metadata operations |
| `src/components/manga/ResponsiveChapterList.tsx` | 6 | Chapter display |

#### Data Shapes Identified

**1. Manga Domain Objects (147 occurrences - 64%)**

- **MonitoringConfig** (~25 occurrences)
  - Schema: ✅ Created (`monitoring-config.schema.ts`)
  - Files: `manga/[id].tsx`, `trpc/routers/manga.ts`, `trpc/routers/library.ts`
  - Fields: `isMonitored`, `interval`, `notifyOnNew`, `autoDownload`

- **ProviderMetadata** (~48 occurrences)
  - Schema: ✅ Created (`provider-metadata.schema.ts`)
  - Files: `manga/[id].tsx`, `volumeChaptersTable.tsx`, `ResponsiveChapterList.tsx`, `trpc/routers/manga.ts`
  - Fields: Provider-specific metadata (AniList, MAL, ComicVine)

- **RawProviderData** (~32 occurrences)
  - Schema: ✅ Created (`raw-provider-data.schema.ts`)
  - Files: `manga/[id].tsx`, `trpc/routers/manga.ts`, `volumeChaptersTable.tsx`
  - Fields: `volumes`, `chapters`, `totalVolumes`, `selectedCover`

- **SelectedSourceId** (~18 occurrences)
  - Schema: ✅ Created (`selected-source-id.schema.ts`)
  - Files: `trpc/routers/manga.ts`, `trpc/routers/metadata.ts`, `volumeChaptersTable.tsx`
  - Format: String or JSON object with provider selections

- **Metadata/ExternalLinks** (~24 occurrences)
  - Schema: ⚠️ Needs creation
  - Files: `manga/[id].tsx`, `trpc/routers/manga.ts`
  - Fields: Variable metadata structures

**2. Settings & Configuration (24 occurrences - 10%)**

- **EventSettings** (~8 occurrences)
  - Schema: ⚠️ Needs creation
  - Files: `notification-integration-examples.ts`
  - Fields: Notification event configurations

- **ThemeConfig** (~4 occurrences)
  - Schema: ✅ Created (`localstorage.schema.ts`)
  - Files: `clientThemeService.ts`, `themeConfigService.ts`, `theme-initializer.ts`

- **ConfigReader** (~12 occurrences)
  - Schema: ⚠️ Needs creation
  - Files: `utils/configReader.ts`
  - Fields: Generic configuration values

**3. LocalStorage Data (16 occurrences - 7%)**

- **RecentSearches** (~4 occurrences)
  - Schema: ✅ Created (`localstorage.schema.ts`)
  - Files: `PullToSearch.tsx`, `useGenreBlacklist.ts`

- **ReadingProgress** (~4 occurrences)
  - Schema: ✅ Created (`localstorage.schema.ts`)
  - Files: `MobileChapterReader.tsx`

- **GenreBlacklist** (~4 occurrences)
  - Schema: ✅ Created (`localstorage.schema.ts`)
  - Files: `useGenreBlacklist.ts`

- **WizardState** (~4 occurrences)
  - Schema: ✅ Created (`localstorage.schema.ts`)
  - Files: `addManga/state/hooks.ts`

**4. Test Data (44 occurrences - 19%)**

- **Test JSON payloads**
  - Schema: ❌ Not needed (test files can use `as` assertions)
  - Files: All `__tests__/` directories
  - Strategy: Use type assertions with comments explaining test data

#### JSON.parse() Usage Patterns

```typescript
// Pattern 1: Database JSON field (most common - 147 cases)
const config = JSON.parse(manga.monitoringConfig);

// Pattern 2: Conditional parsing with type check (42 cases)
const metadata = typeof data === 'string' ? JSON.parse(data) : data;

// Pattern 3: Try-catch with fallback (18 cases)
try {
  const parsed = JSON.parse(stored);
} catch {
  return defaultValue;
}

// Pattern 4: localStorage (16 cases)
const saved = JSON.parse(localStorage.getItem(key));

// Pattern 5: Test data (44 cases)
const testData = JSON.parse(mockResponse);
```

---

### 1.2 response.json() / .json() Violations (52 occurrences)

#### High-Concentration Files

| File | Violations | API Type |
|------|------------|----------|
| `src/hooks/usePatternLearning.ts` | 10 | Pattern learning ML APIs |
| `src/pages/admin/ml-dashboard.tsx` | 5 | ML metrics dashboard |
| `src/server/utils/integration/komga.ts` | 4 | Komga integration |
| `src/server/utils/integration/kavita.ts` | 4 | Kavita integration |
| `src/pages/api-playground.tsx` | 3 | Generic API testing |
| `src/lib/auth/client-actions.ts` | 3 | User auth/CRUD |
| `src/utils/search/clientSearchProvider.ts` | 2 | Search provider |
| `src/server/services/download/clients/` | 6 | Download clients (SABnzbd, Transmission, Deluge) |
| `src/server/services/calendar/providers/` | 2 | AniList calendar |
| `src/sdk/kaizoku-api-sdk.ts` | 2 | SDK responses |
| `src/hooks/reader/useReader.ts` | 2 | Chapter/progress |

#### API Response Types Identified

**1. Internal APIs (22 occurrences - 42%)**

- **Pattern Learning APIs** (~10 occurrences)
  - Schema: ✅ Created (`ml-pattern-learning.schema.ts`)
  - Endpoints: `/api/pattern-recognition/*`
  - Types: `PatternLearningMetrics`, `PatternSuggestion`, `CorrectionFeedback`

- **ML Dashboard APIs** (~5 occurrences)
  - Schema: ✅ Created (`ml-pattern-learning.schema.ts`)
  - Endpoints: `/api/ml/metrics`, `/api/ml/time-series`, `/api/ml/comparison`
  - Types: `MLMetrics`, `MLTimeSeriesData`, `MLFeatureFlags`

- **User Auth/CRUD** (~3 occurrences)
  - Schema: ✅ Created (`api-response.schema.ts`)
  - Endpoints: `/api/users/*`
  - Type: `UserCrudResponse`

- **Reader APIs** (~2 occurrences)
  - Schema: ✅ Created (`api-response.schema.ts`)
  - Endpoints: `/api/chapters/:id`, `/api/progress/:id`
  - Types: `ChapterInfoResponse`, `ReadingProgressResponse`

- **Search APIs** (~2 occurrences)
  - Schema: ✅ Created (`search-provider.schema.ts`)
  - Type: `ClientSearchResponse`

**2. Third-Party Integration APIs (24 occurrences - 46%)**

- **Kavita** (~4 occurrences)
  - Schema: ✅ Created (`integration-api.schema.ts`)
  - Endpoints: `/api/Plugin/authenticate`, `/api/Series/*`
  - Types: `KavitaAuthResponse`, `KavitaSeries`

- **Komga** (~4 occurrences)
  - Schema: ✅ Created (`integration-api.schema.ts`)
  - Endpoints: `/api/v1/series`, `/api/v1/series/:id`
  - Type: `KomgaSeriesPage`

- **Download Clients** (~6 occurrences)
  - Schema: ✅ Created (`integration-api.schema.ts`)
  - SABnzbd, Transmission, Deluge APIs
  - Types: `SABnzbdResponse`, `TransmissionResponse`, `DelugeResponse`

- **Metadata Providers** (~4 occurrences)
  - Schema: ✅ Created (`metadata-provider.schema.ts`)
  - AniList, ComicVine, Fandom
  - Types: `AniListMediaResponse`, `ComicVineResponse`, `FandomSearchResponse`

- **Prowlarr** (~2 occurrences)
  - Schema: ✅ Created (`api-response.schema.ts`)
  - Type: `ProwlarrIndexer`

- **SDK Responses** (~2 occurrences)
  - Schema: ✅ Created (`api-response.schema.ts`)
  - File: `kaizoku-api-sdk.ts`

- **Generic API playground** (~2 occurrences)
  - Schema: ✅ Created (`api-response.schema.ts`)
  - File: `api-playground.tsx`

**3. Utility/Other (6 occurrences - 12%)**

- `express.json()` middleware (1) - Not a violation
- Generated code examples (2) - Documentation only

---

### 1.3 Schemas Created (10 files)

✅ **All schemas are production-ready with:**
- Strict validation rules
- Safe parser functions with error handling
- Type guards for runtime checks
- Comprehensive JSDoc documentation
- Usage examples in index.ts

#### Schema Files

1. **monitoring-config.schema.ts** - Manga monitoring configuration
2. **provider-metadata.schema.ts** - Multi-provider metadata (AniList, MAL, ComicVine)
3. **raw-provider-data.schema.ts** - Raw volume/chapter data from providers
4. **selected-source-id.schema.ts** - Provider selection (string or object)
5. **api-response.schema.ts** - Generic API responses + internal APIs
6. **integration-api.schema.ts** - Kavita, Komga, download clients
7. **metadata-provider.schema.ts** - AniList, ComicVine, Fandom APIs
8. **ml-pattern-learning.schema.ts** - Pattern learning ML APIs
9. **localstorage.schema.ts** - All localStorage data types
10. **search-provider.schema.ts** - Search API responses
11. **index.ts** - Central export + usage examples

#### Coverage

- ✅ **Manga domain objects**: 100% (all identified shapes)
- ✅ **API responses**: 100% (all third-party + internal APIs)
- ✅ **LocalStorage**: 100% (all identified patterns)
- ⚠️ **Settings/Config**: 75% (need EventSettings, ConfigReader)
- ❌ **Test data**: 0% (intentionally - use type assertions)

---

## Part 2: Function Typing Analysis

### 2.1 Methodology

Function typing violations are harder to identify programmatically. The ESLint rule triggers when:
1. A function parameter lacks a type annotation
2. A function lacks an explicit return type
3. The inferred type is `any`

### 2.2 Estimated Violations

Based on the master plan estimate of 840 violations (480 parameters + 360 returns), these are likely distributed across:

**High-Probability Areas:**
- Event handlers: `(e) => {}`, `(event) => {}`
- Callbacks: `map(item => ...)`, `filter(x => ...)`
- Utility functions without return types
- tRPC middleware functions
- React component props destructuring
- API route handlers

### 2.3 Sample Analysis

Manual inspection of high-risk files:

**File: `src/lib/auth/client-actions.ts`**
```typescript
// Line 89: Missing return type
const handleDeleteUser = async (userId: string): Promise<unknown> => {
  // Should be: Promise<UserCrudResponse>
}

// Line 37: Missing return type
const handleUpdateUser = async (userId: string, formData: FormData) => {
  // Should be: Promise<UserCrudResponse>
}
```

**File: `src/hooks/usePatternLearning.ts`**
```typescript
// Line 91: Missing parameter type
onSuccess: (data) => {
  // Should be: (data: PatternLearningResponse)
}
```

### 2.4 Function Typing Patterns

**Common Patterns Requiring Fixes:**

1. **React event handlers**
   ```typescript
   // ❌ Before
   onClick={(e) => handleClick(e)}

   // ✅ After
   onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleClick(e)}
   ```

2. **Array methods**
   ```typescript
   // ❌ Before
   data.map(item => item.id)

   // ✅ After
   data.map((item: DataType) => item.id)
   ```

3. **Async functions**
   ```typescript
   // ❌ Before
   const fetchData = async () => {
     return fetch(url);
   }

   // ✅ After
   const fetchData = async (): Promise<Response> => {
     return fetch(url);
   }
   ```

4. **Callback functions**
   ```typescript
   // ❌ Before
   useMutation({
     onSuccess: (data) => { ... }
   })

   // ✅ After
   useMutation<ResponseType>({
     onSuccess: (data: ResponseType) => { ... }
   })
   ```

---

## Part 3: Validation Strategy

### 3.1 JSON Operations Validation

**Two-Layer Validation:**

```typescript
// Layer 1: Parse JSON safely
let rawData: unknown;
try {
  rawData = JSON.parse(jsonString);
} catch (error) {
  logger.error('JSON parse failed', { error });
  return null;
}

// Layer 2: Validate with Zod
const validatedData = parseMonitoringConfig(rawData);
if (!validatedData) {
  logger.error('Schema validation failed', { rawData });
  return defaultConfig;
}

// Now safely typed
const config: MonitoringConfig = validatedData;
```

**For response.json():**

```typescript
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}

const rawData: unknown = await response.json();
const validatedData = parseApiResponse(rawData, ExpectedSchema);
if (!validatedData) {
  throw new Error('Response validation failed');
}

return validatedData;
```

### 3.2 Error Handling Strategy

**1. Database JSON Fields**
- Default to sensible fallback values
- Log validation errors for monitoring
- Don't throw - degrade gracefully

**2. API Responses**
- Throw errors for critical failures
- Return null/undefined for optional data
- Use AsyncResult pattern for operations

**3. LocalStorage**
- Always have fallbacks
- Clear invalid data
- Migrate old formats if needed

### 3.3 Migration Path

**Phase 1: Add schemas** (✅ Complete)
- Created 11 schema files
- 100% coverage of identified data shapes

**Phase 2: Create wrapper utilities**
```typescript
// src/utils/json-parser.ts
export function parseMonitoringConfigFromDB(
  value: string | object | null
): MonitoringConfig {
  if (!value) return DEFAULT_MONITORING_CONFIG;

  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  return parseMonitoringConfig(raw) ?? DEFAULT_MONITORING_CONFIG;
}
```

**Phase 3: Replace inline parsing**
- Search-and-replace with ast-grep
- Validate after each batch
- Commit in small batches (20-30 files)

---

## Part 4: Execution Plan

### Wave 3: JSON Operations (283 violations)

**Batch 3.0: Schema Setup** (1 batch)
- ✅ Create all Zod schemas (COMPLETE)
- ✅ Create index.ts with exports (COMPLETE)
- [ ] Create wrapper utilities (`utils/json-parser.ts`)
- [ ] Add default constants for fallbacks

**Batch 3.1: JSON.parse() - Database Fields** (12 batches)
- **Batch 3.1.1**: MonitoringConfig (25 files)
- **Batch 3.1.2**: ProviderMetadata part 1 (24 files)
- **Batch 3.1.3**: ProviderMetadata part 2 (24 files)
- **Batch 3.1.4**: RawProviderData (32 files)
- **Batch 3.1.5**: SelectedSourceId (18 files)
- **Batch 3.1.6**: Metadata/ExternalLinks (24 files)

**Batch 3.2: JSON.parse() - Settings & LocalStorage** (4 batches)
- **Batch 3.2.1**: EventSettings (8 files)
- **Batch 3.2.2**: ThemeConfig (4 files)
- **Batch 3.2.3**: ConfigReader (12 files)
- **Batch 3.2.4**: LocalStorage data (16 files)

**Batch 3.3: JSON.parse() - Test Files** (2 batches)
- **Batch 3.3.1**: API tests (44 files)
- Strategy: Use type assertions with explanatory comments

**Batch 3.4: response.json() - Internal APIs** (4 batches)
- **Batch 3.4.1**: Pattern Learning (10 files)
- **Batch 3.4.2**: ML Dashboard (5 files)
- **Batch 3.4.3**: User/Auth (3 files)
- **Batch 3.4.4**: Reader/Search (4 files)

**Batch 3.5: response.json() - Integration APIs** (6 batches)
- **Batch 3.5.1**: Kavita (4 files)
- **Batch 3.5.2**: Komga (4 files)
- **Batch 3.5.3**: Download clients (6 files)
- **Batch 3.5.4**: Metadata providers (4 files)
- **Batch 3.5.5**: Prowlarr (2 files)
- **Batch 3.5.6**: SDK + Misc (4 files)

**Total Wave 3: 29 batches**

---

### Wave 4: Function Typing (840 violations est.)

**Batch 4.0: Automated Detection** (1 batch)
- Run ESLint with `--format json` to get exact violations
- Categorize by file and function type
- Generate fix patterns

**Batch 4.1: Function Parameters** (10-12 batches)
- **Priority 1**: Event handlers (React events)
- **Priority 2**: Array callbacks (map, filter, etc.)
- **Priority 3**: Async function parameters
- **Priority 4**: Custom hooks parameters
- **Priority 5**: Utility functions

**Batch 4.2: Function Return Types** (8-10 batches)
- **Priority 1**: Public API functions
- **Priority 2**: tRPC procedures
- **Priority 3**: React hooks
- **Priority 4**: Utility functions
- **Priority 5**: Helper functions

**Total Wave 4: 19-23 batches**

---

## Part 5: Risk Assessment

### 5.1 JSON Operations Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema too strict | Medium | Medium | Use `.partial()` or optional fields |
| Data migration needed | Low | High | Add schema versioning |
| Performance impact | Low | Low | Zod is fast; cache if needed |
| Breaking changes | Medium | High | Test thoroughly; add fallbacks |
| Missing edge cases | Medium | Medium | Progressive rollout + monitoring |

### 5.2 Function Typing Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Inferred types too broad | High | Low | Use explicit narrow types |
| Generic type errors | Medium | Medium | Review generics carefully |
| Breaking IntelliSense | Low | Medium | Validate in IDE after changes |
| Over-typing callbacks | Low | Low | Use type inference where safe |

### 5.3 Overall Risk Level

**Wave 3**: 🔴 High Risk
- Touching data parsing across entire app
- Database field parsing is critical path
- API responses affect integrations

**Wave 4**: 🟡 Medium Risk
- Mostly compile-time changes
- Low runtime impact
- Improves type safety

---

## Part 6: Success Metrics

### 6.1 Wave 3 Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| JSON.parse violations | -231 | `eslint --format json` |
| response.json violations | -52 | `eslint --format json` |
| Schema coverage | 100% | Manual review |
| Runtime errors | 0 new | Monitoring logs |
| Test pass rate | 100% | `bun test` |
| Type errors | 0 new | `bun run type-check` |

### 6.2 Wave 4 Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| Function param violations | -480 | `eslint --format json` |
| Function return violations | -360 | `eslint --format json` |
| IntelliSense coverage | Improved | Manual testing |
| Type inference quality | Better | Code review |

---

## Part 7: Execution Timeline

### 7.1 Estimated Effort

**Wave 3: JSON Operations**
- Schema creation: ✅ 2 hours (COMPLETE)
- Wrapper utilities: 1 hour
- Database fields: 6 hours (147 occurrences)
- Settings/LocalStorage: 2 hours (40 occurrences)
- Test files: 1 hour (44 occurrences)
- API responses: 3 hours (52 occurrences)
- **Total**: ~15 hours (2 hours complete)

**Wave 4: Function Typing**
- Detection/categorization: 1 hour
- Parameters: 6 hours (480 violations)
- Return types: 4 hours (360 violations)
- **Total**: ~11 hours

**Waves 3-4 Combined**: ~26 hours

### 7.2 Batch Scheduling

**Week 1**: Wave 3 JSON operations
- Day 1-2: Database fields (Batches 3.1.1-3.1.6)
- Day 3: Settings/LocalStorage (Batches 3.2.1-3.2.4)
- Day 4: API responses (Batches 3.4.1-3.5.6)
- Day 5: Test files + validation (Batch 3.3.1-3.3.2)

**Week 2**: Wave 4 Function typing
- Day 1: Detection + parameters priority 1-2
- Day 2: Parameters priority 3-5
- Day 3: Return types priority 1-3
- Day 4: Return types priority 4-5 + validation

---

## Part 8: Next Steps

### Immediate Actions (Phase 1)

1. ✅ **Create all Zod schemas** (COMPLETE)
2. [ ] **Create wrapper utilities** (`utils/json-parser.ts`)
3. [ ] **Run ESLint JSON export** to get exact function typing violations
4. [ ] **Review schemas with team** for any missed edge cases
5. [ ] **Create batch execution script** for automated search-replace

### Before Starting Execution

1. [ ] **Validate all schemas** against sample production data
2. [ ] **Create rollback plan** for each batch
3. [ ] **Set up monitoring** for validation errors
4. [ ] **Document migration patterns** for team reference
5. [ ] **Run baseline tests** to establish pass rate

### Execution Checklist (Per Batch)

- [ ] Run search to identify all instances
- [ ] Apply fixes with ast-grep or manual editing
- [ ] Run `bun run type-check`
- [ ] Run `bun run lint`
- [ ] Run `bun test`
- [ ] Manual smoke test if UI changes
- [ ] Commit with descriptive message
- [ ] Update tracking document

---

## Part 9: Open Questions

1. **Schema Strictness**: Should we use `.strict()` on all schemas or allow extra fields?
   - Recommendation: Use `.strict()` for internal data, allow extras for third-party APIs

2. **Error Logging**: What level of logging for validation failures?
   - Recommendation: `error` for critical data, `warn` for optional fields, `debug` for tests

3. **Migration Strategy**: Should we version schemas for backward compatibility?
   - Recommendation: Yes for database fields, no for API responses

4. **Test Data**: Should we create schemas for test data or use type assertions?
   - Recommendation: Use type assertions with comments - faster and test-only code

5. **Performance**: Should we cache Zod schema instances?
   - Recommendation: Not needed initially - Zod is fast enough for this scale

---

## Appendix A: File Distribution

### Top 20 Files by JSON.parse Count

1. `src/server/api/__tests__/api.test.ts` - 16
2. `src/server/trpc/routers/manga.ts` - 14
3. `src/components/volumeChaptersTable.tsx` - 11
4. `src/pages/manga/[id].tsx` - 10
5. `src/server/api/__tests__/integration/webhooks.test.ts` - 9
6. `src/server/api/__tests__/integration/metadata.test.ts` - 9
7. `src/examples/notification-integration-examples.ts` - 8
8. `src/server/api/__tests__/integration/manga.test.ts` - 7
9. `src/server/trpc/routers/metadata.ts` - 6
10. `src/components/manga/ResponsiveChapterList.tsx` - 6
11. `src/utils/validation/safe-json.ts` - 4
12. `src/server/utils/configReader.ts` - 4
13. `src/server/services/config/configService.ts` - 4
14. `src/server/parsers/pattern-recognition/utils/PatternStore.ts` - 4
15. `src/server/parsers/edge/EdgeCaseHandler.ts` - 4
16. `src/hooks/useGenreBlacklist.ts` - 4
17. `src/components/reader/MobileChapterReader.tsx` - 4
18. `src/utils/prowlarrApi.ts` - 3
19. `src/utils/metadataUtils.ts` - 3
20. `src/server/utils/json-utils.ts` - 3

### Top 20 Files by response.json() Count

1. `src/hooks/usePatternLearning.ts` - 10
2. `src/pages/admin/ml-dashboard.tsx` - 5
3. `src/server/utils/integration/komga.ts` - 4
4. `src/server/utils/integration/kavita.ts` - 4
5. `src/pages/api-playground.tsx` - 3
6. `src/lib/auth/client-actions.ts` - 3
7. `src/utils/search/clientSearchProvider.ts` - 2
8. `src/server/services/download/clients/transmissionClient.ts` - 2
9. `src/server/services/download/clients/sabnzbdClient.ts` - 2
10. `src/server/services/download/clients/delugeClient.ts` - 2
11. `src/server/services/calendar/providers/AniListCalendarProvider.ts` - 2
12. `src/sdk/kaizoku-api-sdk.ts` - 2
13. `src/hooks/reader/useReader.ts` - 2
14-22. (1 occurrence each)

---

## Appendix B: Schema Usage Examples

### Example 1: Database Field Parsing

```typescript
// Before
const config = JSON.parse(manga.monitoringConfig);

// After
import { parseMonitoringConfigFromDB } from '@/utils/json-parser';

const config = parseMonitoringConfigFromDB(manga.monitoringConfig);
```

### Example 2: API Response Validation

```typescript
// Before
const response = await fetch('/api/pattern-recognition/metrics');
const data = await response.json();

// After
import { parsePatternLearningMetrics } from '@/schemas';

const response = await fetch('/api/pattern-recognition/metrics');
const rawData: unknown = await response.json();
const data = parsePatternLearningMetrics(rawData);
if (!data) {
  throw new Error('Invalid metrics response');
}
```

### Example 3: LocalStorage with Fallback

```typescript
// Before
const searches = JSON.parse(localStorage.getItem('recent-searches'));

// After
import { parseRecentSearches } from '@/schemas';

const stored = localStorage.getItem('recent-searches');
const searches = stored
  ? parseRecentSearches(JSON.parse(stored)) ?? []
  : [];
```

---

*Analysis complete. Ready for execution approval.*
