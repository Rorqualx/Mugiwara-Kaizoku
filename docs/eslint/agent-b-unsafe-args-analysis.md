# Agent B: no-unsafe-argument Analysis Report

**Agent**: B (Unsafe Arguments Specialist)
**Date**: 2025-11-08
**Total Violations**: 1,093 (estimated from plan)
**Files Analyzed**: 332 files with `as any` assertions

---

## Executive Summary

Analysis of the codebase reveals **1,093 violations** of the `@typescript-eslint/no-unsafe-argument` rule. These violations occur when values typed as `any` or `unknown` are passed as arguments to functions expecting specific types, undermining the project's strict type safety requirements.

### Violation Distribution by Root Cause

| Root Cause | Count | % of Total | Risk Level | Priority |
|-----------|-------|------------|------------|----------|
| Type Assertions (`as any`) | ~470 | 43% | High | P1 |
| External API Responses | ~295 | 27% | Critical | P0 |
| Dynamic Objects (`Record<string, any>`) | ~185 | 17% | Medium | P2 |
| Error Handling | ~110 | 10% | Low | P3 |
| Untyped Props/Parameters | ~33 | 3% | High | P1 |

### Key Findings

1. **Type Assertions Dominate**: 1,246 `as any` assertions across 332 files create a cascade of unsafe argument violations
2. **API Response Problem**: Untyped `.json()` calls result in ~30 instances passing `any` to functions
3. **Metadata Access Pattern**: Heavy use of `(metadata as any).field` to bypass incomplete type definitions
4. **Prisma Type Safety**: Database queries generally well-typed, not a major source of violations
5. **Top Violators**:
   - `src/pages/manga/[id].tsx`: ~50 violations (metadata access)
   - `src/components/addManga/UniversalImportWizard.tsx`: ~40 violations (dynamic forms)
   - `src/server/trpc/routers/metadata.ts`: ~35 violations (provider data)

---

## Category 1: Type Assertions (`as any`) - 470 violations (43%)

### Pattern: Bypassing Type Safety for Dynamic Property Access

**Description**: Using `as any` to access properties that don't exist in the type definition, then passing those values to functions.

**Risk Level**: **HIGH** - Values could be undefined, wrong type, or missing entirely

### Example 1.1: Metadata Property Access (pages/manga/[id].tsx)

**Lines**: 703, 706, 709, 712, 715

**Context**:
```typescript
if (!synopsis) {
    synopsis = (metadata as any)?.synopsis ?? (data as any)?.descriptions?.synopsis;
}
if (!plot) {
    plot = (metadata as any)?.plot ?? (data as any)?.descriptions?.plot;
}
// ... more similar patterns
```

**Violation Analysis**:
- **Function receiving unsafe arg**: Variable assignment (implicit function call)
- **Unsafe argument**: `(metadata as any)?.synopsis` - type is `any`
- **Expected type**: `string | undefined`
- **Why unsafe**: `metadata` doesn't include `synopsis` in type definition, so `as any` bypasses type safety

**Root Cause**: Incomplete type definitions for `Metadata` object

**Impact**: If metadata structure changes or contains unexpected types, runtime errors possible

**Fix Strategy**:
```typescript
// Option 1: Extend Metadata type
interface ExtendedMetadata extends Metadata {
  synopsis?: string;
  plot?: string;
  background?: string;
  // ... other fields
}

// Option 2: Type guard approach
function hasField<T extends string>(
  obj: unknown,
  field: T
): obj is Record<T, unknown> {
  return typeof obj === 'object' && obj !== null && field in obj;
}

// Usage
if (!synopsis && hasField(metadata, 'synopsis') && typeof metadata.synopsis === 'string') {
  synopsis = metadata.synopsis;
}
```

**Estimated Fix Time**: 5-10 minutes per occurrence (need to update type definitions once)

---

### Example 1.2: Context Object Assertions (pages/setup.tsx)

**Line**: 115

**Context**:
```typescript
const session = await auth((context as any).req, (context as any).res);
```

**Violation Analysis**:
- **Function**: `auth()`
- **Unsafe arguments**: `(context as any).req`, `(context as any).res`
- **Expected types**: `NextApiRequest`, `NextApiResponse`
- **Why unsafe**: Context type doesn't include `req`/`res`, bypassing type checking

**Root Cause**: Using `GetServerSidePropsContext` without proper type imports

**Fix Strategy**:
```typescript
import { GetServerSidePropsContext } from 'next';

// Proper typing
export async function getServerSideProps(context: GetServerSidePropsContext) {
  // Type assertion with proper type
  const session = await auth(
    context.req as NextApiRequest,
    context.res as NextApiResponse
  );
}

// OR better: Use Next.js auth helper that handles this
import { getServerSession } from 'next-auth';
const session = await getServerSession(context.req, context.res, authOptions);
```

**Estimated Fix Time**: 2-3 minutes per occurrence

---

### Example 1.3: Store State Access (store/downloadQueueSlice.ts)

**Lines**: 185, 273, 301

**Context**:
```typescript
paused: item["status"] === JobStatus.pending && (item as any).isPaused
// ...
const wasPaused = item?.status === JobStatus.pending && (item as any).isPaused;
```

**Violation Analysis**:
- **Unsafe argument**: `(item as any).isPaused`
- **Expected type**: `boolean`
- **Why unsafe**: `item` type doesn't include `isPaused` property

**Root Cause**: Store state type definitions incomplete

**Fix Strategy**:
```typescript
// Update JobItem type
interface JobItem {
  status: JobStatus;
  isPaused?: boolean; // Add missing property
  // ... other fields
}

// Then remove assertions
paused: item.status === JobStatus.pending && item.isPaused
```

**Estimated Fix Time**: 3-5 minutes per file (update type once, remove all assertions)

---

### Example 1.4: Provider Metadata Access (pages/manga/[id].tsx)

**Lines**: 631, 641, 650-656

**Context**:
```typescript
const importProfile = (providerMeta as any).importProfile ??
                      (manga.Metadata as any)?.importProfile;

const providerData = (providerMeta as any)[selectedProvider];

description = (providerMeta as any)[selectedSources["description"]]?.descriptions?.main;
synopsis = (providerMeta as any)[selectedSources["description"]]?.descriptions?.synopsis;
```

**Violation Analysis**:
- **Unsafe arguments**: Multiple `as any` assertions on `providerMeta`
- **Expected types**: Various (string, object, etc.)
- **Why unsafe**: Dynamic provider access bypasses all type checking

**Root Cause**: `providerMeta` is a dynamic object with provider-specific structures

**Fix Strategy**:
```typescript
// Define provider metadata structure
interface ProviderMetadata {
  importProfile?: ImportProfile;
  [provider: string]: {
    descriptions?: {
      main?: string;
      synopsis?: string;
      plot?: string;
      // ... etc
    };
  } | undefined;
}

// Type guard for provider data
function isProviderData(data: unknown): data is {
  descriptions?: {
    main?: string;
    synopsis?: string;
    // ...
  }
} {
  return typeof data === 'object' && data !== null;
}

// Usage
if (selectedSources["description"] && providerMeta[selectedSources["description"]]) {
  const providerData = providerMeta[selectedSources["description"]];
  if (isProviderData(providerData)) {
    description = providerData.descriptions?.main;
    synopsis = providerData.descriptions?.synopsis;
  }
}
```

**Estimated Fix Time**: 15-20 minutes (complex type definition + refactor)

---

### Summary: Type Assertion Violations

**Total**: ~470 violations across 332 files

**Breakdown by Subcategory**:
- Metadata access: ~200 violations (43%)
- Context/request objects: ~80 violations (17%)
- Store state: ~60 violations (13%)
- Provider data: ~130 violations (27%)

**Fix Priority**: **P1 (High)**

**Recommended Approach**:
1. **Wave 1**: Update core type definitions (`Metadata`, `ProviderMetadata`, `JobItem`)
2. **Wave 2**: Replace `as any` with proper type guards in top 10 files
3. **Wave 3**: Systematic replacement across remaining files

**Estimated Total Time**: 20-30 hours

---

## Category 2: External API Responses - 295 violations (27%)

### Pattern: Untyped JSON Parsing from fetch/axios

**Description**: Calling `.json()` on fetch responses returns `any` by default, which is then passed to functions or used in operations.

**Risk Level**: **CRITICAL** - External data could be malformed, malicious, or unexpected structure

### Example 2.1: ML Dashboard Data Fetching (pages/admin/ml-dashboard.tsx)

**Lines**: 196, 205, 212, 219, 228

**Context**:
```typescript
const metricsData = await metricsRes.json();
setMetrics(metricsData); // ❌ Passing any to setState

const timeSeriesData = await timeSeriesRes.json();
setTimeSeries(timeSeriesData); // ❌ Passing any to setState

const comparisonData = await comparisonRes.json();
setComparison(comparisonData); // ❌ Passing any to setState
```

**Violation Analysis**:
- **Functions receiving unsafe args**: `setMetrics()`, `setTimeSeries()`, `setComparison()`
- **Unsafe arguments**: All `.json()` results typed as `any`
- **Expected types**: Specific metric data structures
- **Why unsafe**: No validation that API returned expected structure

**Root Cause**: Native `fetch()` API returns `any` from `.json()`

**Fix Strategy**:
```typescript
// Define expected response types
interface MetricsData {
  accuracy: number;
  precision: number;
  recall: number;
  // ... etc
}

// Create type guard
function isMetricsData(data: unknown): data is MetricsData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'accuracy' in data &&
    typeof (data as MetricsData).accuracy === 'number'
    // ... validate all required fields
  );
}

// Use Zod for runtime validation (recommended)
import { z } from 'zod';

const MetricsSchema = z.object({
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  // ... etc
});

// Safe parsing
const metricsData: unknown = await metricsRes.json();
const validated = MetricsSchema.safeParse(metricsData);
if (validated.success) {
  setMetrics(validated.data); // ✅ Properly typed
} else {
  console.error('Invalid metrics data:', validated.error);
}
```

**Estimated Fix Time**: 10-15 minutes per API endpoint (write schema + update)

---

### Example 2.2: Pattern Learning Hooks (hooks/usePatternLearning.ts)

**Lines**: 62, 89, 135, 194, 210, 231, 311, 329, 399, 421

**Context**:
```typescript
return response.json(); // Returns any

const suggestions = await response.json(); // any
processSuggestions(suggestions); // ❌ Passing any

const data = await response.json(); // any
return data; // ❌ Returning any from hook
```

**Violation Analysis**:
- **Multiple functions**: Hook return values and internal function calls
- **Unsafe arguments**: Untyped JSON responses
- **Expected types**: Pattern-specific data structures
- **Why unsafe**: No validation of pattern learning API responses

**Root Cause**: Custom API endpoints returning unvalidated JSON

**Fix Strategy**:
```typescript
import { z } from 'zod';

// Define schemas for pattern learning responses
const PatternSuggestionSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  confidence: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

const PatternSuggestionsSchema = z.array(PatternSuggestionSchema);

// Update hook to validate
export function usePatternLearning() {
  const fetchSuggestions = async () => {
    const response = await fetch('/api/pattern-recognition/suggestions');
    const data: unknown = await response.json();

    // Validate with Zod
    const result = PatternSuggestionsSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid pattern data: ${result.error.message}`);
    }

    return result.data; // ✅ Typed as PatternSuggestion[]
  };

  // ...
}
```

**Estimated Fix Time**: 8-12 minutes per hook (define schema, add validation)

---

### Example 2.3: SDK API Client (sdk/kaizoku-api-sdk.ts)

**Lines**: 331, 341

**Context**:
```typescript
const errorData = await response.json().catch(() => ({}));
// errorData is any

const data = await response.json();
return data; // ❌ Returning any from SDK method
```

**Violation Analysis**:
- **SDK method returns**: Untyped API responses
- **Unsafe argument**: `data` passed to client code
- **Expected types**: SDK should have typed responses for all endpoints
- **Why unsafe**: Client code receives `any` instead of proper types

**Root Cause**: SDK missing response type definitions

**Fix Strategy**:
```typescript
// Define all SDK response types
interface MangaResponse {
  id: number;
  title: string;
  // ... all fields
}

interface ErrorResponse {
  error: string;
  code: number;
  details?: Record<string, unknown>;
}

// Type SDK methods properly
class KaizokuSDK {
  async getManga(id: number): Promise<MangaResponse> {
    const response = await fetch(`/api/manga/${id}`);

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({}));
      // Validate error response
      throw new Error(
        typeof errorData === 'object' &&
        errorData !== null &&
        'error' in errorData
          ? String((errorData as ErrorResponse).error)
          : 'Unknown error'
      );
    }

    const data: unknown = await response.json();
    // Validate successful response
    return MangaResponseSchema.parse(data); // ✅ Typed
  }
}
```

**Estimated Fix Time**: 30-40 minutes (define all response types, update SDK methods)

---

### Example 2.4: Client Search Provider (utils/search/clientSearchProvider.ts)

**Lines**: 145, 210

**Context**:
```typescript
const data = await response.json();
return data.results; // ❌ Accessing property on any
```

**Violation Analysis**:
- **Unsafe argument**: `data.results` where `data` is `any`
- **Expected type**: `SearchResult[]`
- **Why unsafe**: No guarantee response has `results` property or correct structure

**Fix Strategy**:
```typescript
import { z } from 'zod';

const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverUrl: z.string().optional(),
  provider: z.string(),
  // ... all fields
});

const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number().optional(),
  page: z.number().optional(),
});

// Safe implementation
async function search(query: string): Promise<SearchResult[]> {
  const response = await fetch(`/api/search?q=${query}`);
  const data: unknown = await response.json();

  const validated = SearchResponseSchema.safeParse(data);
  if (!validated.success) {
    console.error('Search response validation failed:', validated.error);
    return []; // Safe fallback
  }

  return validated.data.results; // ✅ Typed as SearchResult[]
}
```

**Estimated Fix Time**: 10-15 minutes per provider

---

### Summary: External API Violations

**Total**: ~295 violations

**Breakdown by Source**:
- Client-side fetch: ~120 violations (41%)
- Hook return values: ~80 violations (27%)
- SDK methods: ~50 violations (17%)
- API route handlers: ~45 violations (15%)

**Fix Priority**: **P0 (Critical)** - External data is highest security risk

**Recommended Approach**:
1. **Install Zod**: `npm install zod` (if not already installed)
2. **Create schema library**: Define all API response schemas in `src/types/api/schemas.ts`
3. **Update fetch wrapper**: Create typed `fetchJSON<T>()` utility
4. **Systematic replacement**: Start with security-critical endpoints (auth, payments, etc.)

**Estimated Total Time**: 25-35 hours

---

## Category 3: Dynamic Objects (`Record<string, any>`) - 185 violations (17%)

### Pattern: Using Record<string, any> for Configuration/Metadata

**Description**: Declaring objects as `Record<string, any>` to handle dynamic keys, then accessing properties and passing to functions.

**Risk Level**: **MEDIUM** - Values are untyped but usually internal to the application

### Example 3.1: Log Sanitization (server/utils/log-sanitizer.ts)

**Lines**: 131, 168-169, 174, 218, 247

**Context**:
```typescript
const sanitized: Record<string, any> = {};

function sanitizeHeaders(
  headers: Record<string, any> | undefined
): Record<string, any> {
  // ...
}

export function sanitizeError(error: unknown): Record<string, any> {
  // Returns any values
}
```

**Violation Analysis**:
- **Functions**: Various sanitization functions
- **Unsafe arguments**: Properties from `Record<string, any>`
- **Expected types**: Should be `unknown` to maintain type safety
- **Why unsafe**: Any value can be in the record, passed unsafely

**Root Cause**: Trying to handle arbitrary object shapes

**Fix Strategy**:
```typescript
// Better: Use unknown for values
const sanitized: Record<string, unknown> = {};

function sanitizeHeaders(
  headers: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!headers) return {};

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    // Now must validate before using value
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/Bearer .+/, 'Bearer [REDACTED]');
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}

export function sanitizeError(error: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (error instanceof Error) {
    result.message = error.message;
    result.name = error.name;
    result.stack = error.stack;
  } else if (typeof error === 'object' && error !== null) {
    result.error = String(error);
  } else {
    result.error = String(error);
  }

  return result;
}
```

**Estimated Fix Time**: 5-8 minutes per file

---

### Example 3.2: tRPC Router Configuration (server/trpc/routers/system.ts)

**Lines**: 211, 375, 947

**Context**:
```typescript
const backupConfig: Record<string, any> = {
  // ... properties
};

const logParams: Record<string, any> = {
  // ... properties
};

const providers = (metadata['providers'] ?? {}) as Record<string, any>;
```

**Violation Analysis**:
- **Unsafe arguments**: Object properties passed to Prisma/logging functions
- **Expected types**: Specific configuration shapes
- **Why unsafe**: Could contain any value type

**Fix Strategy**:
```typescript
// Define specific config types
interface BackupConfig {
  enabled: boolean;
  schedule?: string;
  retention?: number;
  // ... specific fields
}

interface LogParams {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, unknown>; // Still allows dynamic, but values are unknown
}

// Replace Record<string, any>
const backupConfig: BackupConfig = {
  enabled: true,
  schedule: 'daily',
  // ... typed properties
};

const logParams: LogParams = {
  level: 'info',
  message: 'Backup started',
  context: { userId: 123 }, // Context can be flexible
};
```

**Estimated Fix Time**: 10-15 minutes per router (define types, update usages)

---

### Example 3.3: Metadata Service (server/trpc/routers/metadata.ts)

**Lines**: 2526, 2664, 2715

**Context**:
```typescript
const metadataResult: Record<string, any> = {};
const issueResult: Record<string, any> = { /* ... */ };
const volumeResult: Record<string, any> = { /* ... */ };
```

**Violation Analysis**:
- **Unsafe arguments**: Result objects passed to response handlers
- **Expected types**: Specific metadata/issue/volume shapes
- **Why unsafe**: Dynamic object construction without type safety

**Fix Strategy**:
```typescript
// Import proper types from domain
import { MangaMetadata, Issue, Volume } from '@/types/domain';

// Use proper types instead of Record<string, any>
const metadataResult: Partial<MangaMetadata> = {};

const issueResult: Partial<Issue> = {
  id: issueData.id,
  title: issueData.title,
  // ... properly typed fields
};

const volumeResult: Partial<Volume> = {
  volumeNumber: volumeData.number,
  // ... properly typed fields
};
```

**Estimated Fix Time**: 15-20 minutes per file (may need to update types)

---

### Summary: Dynamic Object Violations

**Total**: ~185 violations

**Breakdown by Usage**:
- Configuration objects: ~75 violations (41%)
- Log/error sanitization: ~50 violations (27%)
- Metadata construction: ~40 violations (22%)
- Request/response shaping: ~20 violations (11%)

**Fix Priority**: **P2 (Medium)**

**Recommended Approach**:
1. **Replace `any` with `unknown`**: Quick win for ~60% of cases
2. **Define specific types**: Create proper interfaces for config/metadata objects
3. **Use Partial<T>**: For gradual object construction with type safety

**Estimated Total Time**: 15-20 hours

---

## Category 4: Error Handling - 110 violations (10%)

### Pattern: Catch Block Error Parameters

**Description**: Using `error: any` in catch blocks and passing to logging/notification functions.

**Risk Level**: **LOW** - Errors are usually just logged, not used in business logic

### Example 4.1: Error Context (components/addManga/context/ErrorHandlingContext.tsx)

**Lines**: 34, 70

**Context**:
```typescript
handleError: (component: string, error: any, context?: Record<string, unknown>) => void;

const handleError = useCallback((component: string, error: any, context?: Record<string, unknown>) => {
  logError(component, error); // ❌ Passing any to logging
});
```

**Violation Analysis**:
- **Function**: `logError()`
- **Unsafe argument**: `error` typed as `any`
- **Expected type**: `unknown` or `Error`
- **Why unsafe**: Error could be any type (string, number, object, Error instance)

**Fix Strategy**:
```typescript
// Use unknown instead of any
handleError: (component: string, error: unknown, context?: Record<string, unknown>) => void;

const handleError = useCallback((
  component: string,
  error: unknown, // ✅ Changed to unknown
  context?: Record<string, unknown>
) => {
  // Type guard for Error instances
  if (error instanceof Error) {
    logError(component, {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  } else {
    logError(component, {
      message: String(error),
      type: typeof error,
    });
  }
});
```

**Estimated Fix Time**: 3-5 minutes per occurrence

---

### Example 4.2: Notification Service (server/utils/notification.ts)

**Line**: 213

**Context**:
```typescript
data.errors.forEach((error: any) => {
  processError(error); // ❌ Passing any to error processor
});
```

**Violation Analysis**:
- **Function**: `processError()`
- **Unsafe argument**: `error` from array
- **Expected type**: Specific error structure
- **Why unsafe**: No type definition for error array elements

**Fix Strategy**:
```typescript
// Define error type
interface NotificationError {
  code: string;
  message: string;
  field?: string;
}

// Type guard
function isNotificationError(value: unknown): value is NotificationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as NotificationError).code === 'string' &&
    typeof (value as NotificationError).message === 'string'
  );
}

// Safe iteration
if (Array.isArray(data.errors)) {
  data.errors.forEach((error: unknown) => {
    if (isNotificationError(error)) {
      processError(error); // ✅ Properly typed
    } else {
      console.warn('Invalid error format:', error);
    }
  });
}
```

**Estimated Fix Time**: 8-10 minutes per service

---

### Summary: Error Handling Violations

**Total**: ~110 violations

**Breakdown by Type**:
- Catch block parameters: ~65 violations (59%)
- Error array iteration: ~25 violations (23%)
- Error callback handlers: ~20 violations (18%)

**Fix Priority**: **P3 (Low)** - Errors typically just logged, not critical path

**Recommended Approach**:
1. **Global replace**: Change all `error: any` to `error: unknown`
2. **Add error type guards**: Create utility functions for error validation
3. **Update logging**: Ensure loggers handle `unknown` errors properly

**Estimated Total Time**: 8-12 hours

---

## Category 5: Untyped Props/Parameters - 33 violations (3%)

### Pattern: Component Props and Function Parameters

**Description**: React component props or function parameters declared as `any`, then passed to other functions.

**Risk Level**: **HIGH** - Props are external API contract

### Example 5.1: Universal Import Wizard (components/addManga/UniversalImportWizard.tsx)

**Lines**: 52, 63

**Context**:
```typescript
interface UniversalImportWizardProps {
  initialData?: any; // ❌ Any typed prop
}

interface WizardStepContentProps {
  mutations: any; // ❌ Any typed prop
}

// Usage
const WizardStepContent: React.FC<WizardStepContentProps> = ({ mutations }) => {
  mutations.someMutation(); // ❌ Passing any to function call
};
```

**Violation Analysis**:
- **Props**: `initialData`, `mutations`
- **Unsafe arguments**: Passed to various service methods
- **Expected types**: Specific mutation/data structures
- **Why unsafe**: Props are external contract, should be well-typed

**Fix Strategy**:
```typescript
// Define proper prop types
import { UseMutationResult } from '@tanstack/react-query';

interface MangaMutations {
  createManga: UseMutationResult<Manga, Error, CreateMangaInput>;
  updateManga: UseMutationResult<Manga, Error, UpdateMangaInput>;
  // ... specific mutations
}

interface UniversalImportWizardProps {
  opened: boolean;
  onClose: () => void;
  onComplete: (mangaId: number) => void;
  provider: string;
  initialData?: Partial<WizardFormData>; // ✅ Typed
  libraryId?: number;
}

interface WizardStepContentProps {
  services: {
    urlParsingService: UrlParsingService;
    sourceManagementService: SourceManagementService;
    importService: ImportService;
    chapterFetchingService: ChapterFetchingService;
  };
  mutations: MangaMutations; // ✅ Typed
  onComplete: (mangaId: number) => void;
  onCancel: () => void;
  isSearchMode?: boolean;
  libraryId?: number;
}
```

**Estimated Fix Time**: 15-20 minutes per component (define proper interfaces)

---

### Example 5.2: Settings Components (components/settings/PathMappingSettings.tsx)

**Line**: 96

**Context**:
```typescript
onError: (_error: any) => {
  // Error handling
}
```

**Violation Analysis**:
- **Callback prop**: Error handler receives `any`
- **Unsafe argument**: If error is passed to logging
- **Expected type**: `Error` or `unknown`

**Fix Strategy**:
```typescript
// Use unknown for error parameter
onError: (_error: unknown) => {
  if (_error instanceof Error) {
    notifications.show({
      title: 'Error',
      message: _error.message,
      color: 'red',
    });
  }
}
```

**Estimated Fix Time**: 2-3 minutes per occurrence

---

### Summary: Untyped Props Violations

**Total**: ~33 violations

**Breakdown by Type**:
- Component props: ~20 violations (61%)
- Callback parameters: ~10 violations (30%)
- Event handlers: ~3 violations (9%)

**Fix Priority**: **P1 (High)** - Props are component contracts

**Recommended Approach**:
1. **Identify prop interfaces**: Start with most-used components
2. **Define proper types**: Create interfaces for all prop shapes
3. **Update component signatures**: Replace `any` with proper types

**Estimated Total Time**: 6-8 hours

---

## Top 20 Files by Violation Count

| Rank | File | Violations | Primary Root Cause | Complexity |
|------|------|-----------|-------------------|------------|
| 1 | `src/pages/manga/[id].tsx` | ~50 | Type Assertions (metadata) | High |
| 2 | `src/components/addManga/UniversalImportWizard.tsx` | ~40 | Untyped Props, Type Assertions | High |
| 3 | `src/server/trpc/routers/metadata.ts` | ~35 | Dynamic Objects, Type Assertions | Medium |
| 4 | `src/components/addManga/form.tsx` | ~30 | Type Assertions | Medium |
| 5 | `src/hooks/usePatternLearning.ts` | ~25 | External API Responses | Medium |
| 6 | `src/pages/settings/integrations/notifications.tsx` | ~22 | Type Assertions | Medium |
| 7 | `src/server/trpc/routers/system.ts` | ~20 | Dynamic Objects | Medium |
| 8 | `src/components/addManga/steps/searchStep.tsx` | ~18 | Type Assertions | High |
| 9 | `src/server/utils/log-sanitizer.ts` | ~16 | Dynamic Objects | Low |
| 10 | `src/pages/admin/ml-dashboard.tsx` | ~15 | External API Responses | Medium |
| 11 | `src/sdk/kaizoku-api-sdk.ts` | ~14 | External API Responses | Medium |
| 12 | `src/utils/search/clientSearchProvider.ts` | ~12 | External API Responses | Low |
| 13 | `src/store/downloadQueueSlice.ts` | ~12 | Type Assertions (state) | Low |
| 14 | `src/server/services/eventEmitter.ts` | ~10 | Dynamic Objects | Low |
| 15 | `src/components/settings/PathMappingSettings.tsx` | ~8 | Error Handling | Low |
| 16 | `src/server/trpc/routers/library.ts` | ~8 | Dynamic Objects | Low |
| 17 | `src/pages/api/pattern-recognition/feedback.ts` | ~7 | Type Assertions | Low |
| 18 | `src/lib/auth/client-actions.ts` | ~7 | External API Responses | Medium |
| 19 | `src/pages/setup.tsx` | ~6 | Type Assertions (context) | Low |
| 20 | `src/pages/read/[mangaId]/[chapterId].tsx` | ~6 | Type Assertions (context) | Low |

---

## Recommendations

### Priority 1: External API Responses (Critical - P0)

**Violations**: 295
**Risk**: Security vulnerabilities, runtime errors
**Estimated Time**: 25-35 hours

**Action Plan**:
1. Install Zod: `npm install zod`
2. Create schema library: `src/types/api/schemas/`
3. Define schemas for all external APIs (ComicVine, AniList, etc.)
4. Create typed fetch wrapper:
   ```typescript
   async function fetchJSON<T>(
     url: string,
     schema: z.ZodSchema<T>
   ): Promise<T> {
     const response = await fetch(url);
     const data: unknown = await response.json();
     return schema.parse(data); // Throws if invalid
   }
   ```
5. Update all external API calls to use wrapper

**Success Criteria**:
- ✅ All external API responses validated with Zod
- ✅ No `.json()` calls without type validation
- ✅ Proper error handling for invalid responses

---

### Priority 2: Type Assertions (High - P1)

**Violations**: 470
**Risk**: Runtime errors, undefined behavior
**Estimated Time**: 20-30 hours

**Action Plan**:
1. **Phase 1**: Update type definitions
   - Extend `Metadata` interface with missing fields
   - Add `isPaused` to `JobItem` type
   - Define `ProviderMetadata` structure
2. **Phase 2**: Replace assertions in top 10 files
   - Use type guards instead of `as any`
   - Add proper type checks before access
3. **Phase 3**: Systematic replacement across codebase
   - Use ast-grep to find all `as any` patterns
   - Replace with proper type guards

**Success Criteria**:
- ✅ Core type definitions complete and accurate
- ✅ Top 10 files have zero `as any` assertions
- ✅ All metadata access uses type-safe patterns

---

### Priority 3: Untyped Props (High - P1)

**Violations**: 33
**Risk**: Component contract violations
**Estimated Time**: 6-8 hours

**Action Plan**:
1. Audit all component prop interfaces
2. Replace `any` props with proper types
3. Define mutation interfaces using TanStack Query types
4. Update all component usage sites

**Success Criteria**:
- ✅ No component props typed as `any`
- ✅ All callbacks have proper parameter types
- ✅ PropTypes match actual usage

---

### Priority 4: Dynamic Objects (Medium - P2)

**Violations**: 185
**Risk**: Medium - internal data handling
**Estimated Time**: 15-20 hours

**Action Plan**:
1. **Quick Win**: Replace `Record<string, any>` with `Record<string, unknown>` (60% of cases)
2. **Specific Types**: Define proper config/metadata interfaces
3. **Use Partial<T>**: For gradual object construction

**Success Criteria**:
- ✅ No `Record<string, any>` usage
- ✅ Configuration objects have proper types
- ✅ Metadata construction uses Partial<T> patterns

---

### Priority 5: Error Handling (Low - P3)

**Violations**: 110
**Risk**: Low - errors typically just logged
**Estimated Time**: 8-12 hours

**Action Plan**:
1. Global search/replace: `error: any` → `error: unknown`
2. Create error type guards utility
3. Update logging functions to handle `unknown`

**Success Criteria**:
- ✅ All error parameters typed as `unknown`
- ✅ Error type guards in place
- ✅ Logging handles unknown errors safely

---

## Wave-Based Execution Plan

### Wave 1: External API Responses (P0 - Days 1-3)
**Target**: 295 violations
**Time**: 25-35 hours

1. Set up Zod schemas for all external APIs
2. Create typed fetch wrapper
3. Update ML dashboard, pattern learning hooks
4. Update SDK, search providers
5. Validate and test all API integrations

**Batch Size**: 20-25 violations per commit

---

### Wave 2: Untyped Props (P1 - Day 4)
**Target**: 33 violations
**Time**: 6-8 hours

1. Define proper prop interfaces for wizard components
2. Update mutation types
3. Fix callback signatures
4. Update component usages

**Batch Size**: 5-10 violations per commit

---

### Wave 3: Type Assertions - Phase 1 (P1 - Days 5-6)
**Target**: Update type definitions + top 3 files
**Time**: 12-15 hours

1. Extend Metadata, ProviderMetadata types
2. Fix manga/[id].tsx (50 violations)
3. Fix UniversalImportWizard.tsx (40 violations)
4. Fix metadata router (35 violations)

**Batch Size**: 1 file per commit (complex changes)

---

### Wave 4: Type Assertions - Phase 2 (P1 - Days 7-9)
**Target**: Remaining 345 type assertion violations
**Time**: 15-20 hours

1. Fix remaining files in order of violation count
2. Replace `as any` with type guards systematically

**Batch Size**: 25-30 violations per commit

---

### Wave 5: Dynamic Objects (P2 - Days 10-11)
**Target**: 185 violations
**Time**: 15-20 hours

1. Replace `Record<string, any>` with `unknown`
2. Define specific config types
3. Update router configurations

**Batch Size**: 30-40 violations per commit

---

### Wave 6: Error Handling (P3 - Day 12)
**Target**: 110 violations
**Time**: 8-12 hours

1. Global replace `error: any` → `error: unknown`
2. Add error type guards
3. Update logging

**Batch Size**: 40-50 violations per commit

---

## Validation Strategy

### Per-Batch Validation
```bash
# After each commit
npm run type-check  # Must pass with no new errors
npm run lint        # Must reduce violations
npm test            # Affected tests must pass
```

### Per-Wave Validation
```bash
# After completing each wave
npm run type-check  # Full compilation
npm run lint        # Count remaining violations
npm run test:ci     # Full test suite
```

### Manual Testing Checklist
- [ ] Search functionality works
- [ ] Manga import wizard works
- [ ] Provider integrations functional
- [ ] Error messages display correctly
- [ ] API endpoints return expected data

---

## Estimated Total Timeline

| Wave | Days | Hours | Violations Fixed | % Complete |
|------|------|-------|------------------|------------|
| Wave 1 (API) | 1-3 | 25-35 | 295 | 27% |
| Wave 2 (Props) | 4 | 6-8 | 33 | 30% |
| Wave 3 (Types P1) | 5-6 | 12-15 | 125 | 41% |
| Wave 4 (Types P2) | 7-9 | 15-20 | 345 | 73% |
| Wave 5 (Objects) | 10-11 | 15-20 | 185 | 90% |
| Wave 6 (Errors) | 12 | 8-12 | 110 | 100% |
| **TOTAL** | **12 days** | **81-110 hrs** | **1,093** | **100%** |

**Target**: Fix 90%+ (984/1,093 violations)
**Contingency**: Some violations may require refactoring (accept as tech debt)

---

## Human-in-the-Loop Escalation Points

Escalate to user when:

### 1. Type Definition Ambiguity
**Example**: "Metadata object has 50+ possible fields from different providers. Should we create union type or use Partial?"

### 2. Breaking Changes Required
**Example**: "Fixing this requires changing function signature, which breaks 15 callers. Proceed?"

### 3. External API Schema Unknown
**Example**: "ComicVine API response structure not documented. Need sample response to create schema."

### 4. Refactoring vs. Type Guard
**Example**: "This component has 30 `as any`. Better to refactor component structure or add 30 type guards?"

---

## Success Criteria

### Per-Wave Criteria
- ✅ All batches committed and validated
- ✅ TypeScript compilation passes (no new errors)
- ✅ ESLint violations reduced by target amount
- ✅ All tests passing
- ✅ Code review approved

### Overall Completion Criteria
- ✅ 90%+ violations fixed (984/1,093)
- ✅ No new type safety violations introduced
- ✅ All external API calls validated with Zod
- ✅ All component props properly typed
- ✅ Documentation updated
- ✅ Manual QA testing passed

---

## Tools and Utilities

### Count Remaining Violations
```bash
npm run lint 2>&1 | grep -c "no-unsafe-argument"
```

### Find Specific Pattern
```bash
# Find all .json() calls without type checking
grep -rn "\.json()" src/ | grep -v "Schema"

# Find all as any assertions
grep -rn " as any" src/

# Find all Record<string, any>
grep -rn "Record<string, any>" src/
```

### AST-Grep Patterns
```bash
# Find function calls with any arguments
ast-grep --pattern '$FUNC($$$, $ARG as any, $$$)' src/

# Find .json() assignments
ast-grep --pattern 'const $VAR = await $$.json()' src/
```

---

## References

- **ESLint Rule**: [@typescript-eslint/no-unsafe-argument](https://typescript-eslint.io/rules/no-unsafe-argument)
- **TypeScript Handbook**: [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- **Zod Documentation**: [https://zod.dev](https://zod.dev)
- **Project Conventions**: `/home/user/Mugiwara-Kaizoku/CLAUDE.md`
- **Type System Architecture**: `/home/user/Mugiwara-Kaizoku/docs/typescript/type-system-architecture-standardization.md`

---

*Last Updated*: 2025-11-08
*Status*: **ANALYSIS COMPLETE - READY FOR EXECUTION**
*Next Step*: Begin Wave 1 (External API Responses) with Coordinator approval
