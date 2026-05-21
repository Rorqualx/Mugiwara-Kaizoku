# Type Safety Improvements

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Type Safety Improvements

---
# Type Safety Improvements

This document outlines the improvements made to the codebase's type safety, focusing on the elimination of unsafe `as any` type assertions and the introduction of proper type definitions.

## Background

The codebase previously contained numerous `as any` type assertions, which bypass TypeScript's type checking and can lead to runtime errors. These assertions were used in various contexts:

1. API integration with third-party services
2. Handling circular references in data structures
3. Accessing properties that might not exist on an object
4. Working with middleware and authentication
5. Passing parameters between tRPC routers
6. Database transaction handling
7. Task queue payload validation

## Approach

Our strategy for improving type safety included:

1. **Identifying Unsafe Assertions**: Locating all instances of `as any` in the codebase
2. **Creating Proper Type Definitions**: Defining clear interfaces for data structures
3. **Implementing Utility Functions**: Creating type-safe utility functions for common patterns
4. **Using Type Guards**: Employing proper type narrowing with type guards
5. **Applying the Adapter Pattern**: Converting between API types and application types
6. **Adding Validation Logic**: Validating data before type casting

## Key Improvements

### 1. Authentication Middleware

In `middleware.ts`, we replaced unsafe assertions when accessing the auth token:

```typescript
// Before
const token = (req as any).auth?.token;
const userRole = token?.role as UserRole | undefined;

// After
const token = req.auth?.token;
const userRole = token?.role;
```

We created proper type definitions in `next-auth-middleware.d.ts`:

```typescript
declare module 'next-auth/middleware' {
  interface NextRequestWithAuth {
    auth?: {
      token?: {
        id: string;
        role: UserRole;
        avatar?: string;
        name?: string;
        email?: string;
        exp?: number;
        iat?: number;
        jti?: string;
      };
    };
  }
}
```

### 2. System Status and Integration Context

We improved type safety in the `IntegrationStatusContext.tsx` by:

1. Creating a proper `SystemStatusResponse` type
2. Using type guards for safer property access
3. Properly handling errors with specific error types

```typescript
// Before
if ((systemStatus as any)?.integrations) {
  setIntegrationData((systemStatus as any).integrations);
  setIsLoading(false);
}

// After
if (systemStatus && 'integrations' in systemStatus) {
  setIntegrationData((systemStatus as SystemStatusResponse).integrations || null);
  setIsLoading(false);
}
```

### 3. Router Type Safety

In the legacy `router.ts` file, we improved type safety for redirected API calls by:

1. Creating specific types for router procedures
2. Using these types for method calls rather than unsafe assertions
3. Adding proper input types for redirected calls

```typescript
// Before
return await (settingsRouter.providers?.list as any)?.();

// After
const listMethod = settingsRouter.providers?.list as ProviderListMethod;
return await listMethod();
```

### 4. App Providers Session Typing

In `AppProviders.tsx`, we replaced unsafe assertions for the NextAuth session:

```typescript
// Before
<SessionProvider session={session as any}>

// After
// Added proper type import
import { Session } from 'next-auth';

// Updated component props
export function AppProviders({ 
  children,
  session
}: { 
  children: React.ReactNode;
  session?: Session | null;
}) {
  ...
}

// Removed type assertion
<SessionProvider session={session}>
```

### 5. Provider Metadata Type Safety

In `system.ts`, we improved type safety for metadata handling by:

1. Creating proper types for metadata structures
2. Using type guards for safely accessing provider settings
3. Adding proper validation for object structures

```typescript
// Before
// Using any types for metadata objects and operations
Object.keys((metadata as any)[provider.id].settings).forEach((key: any) => {
  updatedMetadata.providers[provider.id].settings[key] = (metadata as any)[provider.id].settings[key];
});

// After
// Created proper type definitions
export interface LegacyProvider {
  enabled?: boolean;
  settings?: ProviderSettings;
  [key: string]: unknown;
}

// Using type-safe operations
const legacyMetadata = metadata as LegacyMetadata;
const providerSettings = legacyMetadata[provider.id]?.settings;

if (providerSettings) {
  Object.keys(providerSettings).forEach((key: string) => {
    if (!provider.settingsKeys.includes(key)) {
      updatedMetadata.providers[provider.id].settings[key] = providerSettings[key];
    }
  });
}
```

### 6. Database Transaction Type Safety

In `queueManager.ts`, we improved type safety for Prisma transactions:

```typescript
// Before
return await (prisma.$transaction as any)(async (tx: TransactionClient) => {
  const task = await (tx as any).task.findFirst({
    where: {
      status: TaskStatus.PENDING,
      scheduledAt: { lte: new Date() }
    },
    orderBy: { createdAt: 'asc' }
  });
});

// After
// Created typed transaction client
export interface TaskClient {
  findFirst: (params: {
    where: {
      status: TaskStatus;
      scheduledAt: { lte: Date };
    };
    orderBy: { createdAt: 'asc' | 'desc' };
  }) => Promise<Task | null>;
  
  update: (params: {
    where: { id: number };
    data: {
      status: TaskStatus;
      updatedAt: Date;
      [key: string]: any;
    };
  }) => Promise<Task>;
}

export interface TypedTransactionClient {
  task: TaskClient;
  [key: string]: any;
}

// Using typed transaction client
return await prisma.$transaction(async (tx: unknown) => {
  const typedTx = tx as TypedTransactionClient;
  
  const task = await typedTx.task.findFirst({
    where: {
      status: TaskStatus.PENDING,
      scheduledAt: { lte: new Date() }
    },
    orderBy: { createdAt: 'asc' }
  });
});
```

### 7. Task Payload Type Safety

In `queue/index.ts`, we improved type safety for task payloads:

```typescript
// Before
await handler(payload as any);

// After
// Using type guard to validate payload before passing to handler
if (isValidTaskPayload(task.type as TaskType, payload)) {
  await handler(payload);
} else {
  throw new Error(`Invalid payload for task type: ${task.type}`);
}
```

### 8. Chapter Metadata Type Safety

In `metadataMerger.ts`, we improved type safety for chapter operations:

```typescript
// Before - Chapter Update
await prisma.chapter.update({
  where: { id: chapter.id },
  data: {
    title: enhancedChapter.title || chapter.title
  } as any
});

// After - Chapter Update
const updateData: ChapterUpdateInput = {
  title: enhancedChapter.title || chapter.title
};

await prisma.chapter.update({
  where: { id: chapter.id },
  data: updateData
});

// Before - Chapter Create
await prisma.chapter.create({
  data: {
    mangaId: manga.id,
    fileName: `c${enhancedChapter.number}`,
    index: enhancedChapter.number,
    title: enhancedChapter.title,
    size: 0,
    downloadStatus: 'PENDING'
  } as any
});

// After - Chapter Create
const createData: ChapterCreateInput = {
  mangaId: manga.id,
  fileName: `c${enhancedChapter.number}`,
  index: enhancedChapter.number,
  title: enhancedChapter.title,
  size: 0,
  downloadStatus: 'PENDING'
};

await prisma.chapter.create({
  data: createData
});
```

We created dedicated type definitions in `chapter-metadata.ts`:

```typescript
export interface ChapterUpdateInput {
  title?: string;
  fileName?: string;
  index?: number;
  size?: number;
  downloadStatus?: ChapterStatus;
  language?: string;
  pageCount?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  resolutionLabel?: string;
  mangaId?: number;
  [key: string]: unknown;
}

export interface ChapterCreateInput {
  mangaId: number;
  fileName: string;
  index?: number;
  title: string;
  size: number;
  downloadStatus: ChapterStatus;
  language?: string;
  pageCount?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  resolutionLabel?: string;
  [key: string]: unknown;
}
```

### 9. MangaDex Search Provider Type Safety

In `mangadexProvider.ts`, we improved type safety for the search provider:

```typescript
// Before
return results.map(manga => ({
  id: manga.id,
  title: manga.title,
  // ... other fields
  tags: manga.tags?.map((tag: string, index: number) => ({
    id: index,
    name: tag,
    category: 'tag'
  })),
  externalLinks: manga.links ? Object.entries(manga.links).map(([site, url], index) => ({
    id: index,
    url: String(url),
    site: site
  })) : undefined,
  dateAdded: manga.createdAt,
  dateLastUpdated: manga.updatedAt
})) as any;

// After
// Created proper interface for search results
export interface MangaDexSearchResult extends SearchResult {
  source: 'manga';
  countryOfOrigin?: string;
  isLicensed?: boolean;
  tags?: MangaDexTag[];
  externalLinks?: MangaDexExternalLink[];
  dateAdded?: string;
  dateLastUpdated?: string;
}

// Type-safe implementation
return results.map(manga => {
  // Create tags array if available
  const tags: MangaDexTag[] | undefined = manga.tags?.map((tag: string, index: number) => ({
    id: index,
    name: tag,
    category: 'tag'
  }));
  
  // Create external links array if available
  const externalLinks: MangaDexExternalLink[] | undefined = manga.links 
    ? Object.entries(manga.links).map(([site, url], index) => ({
        id: index,
        url: String(url),
        site: site
      })) 
    : undefined;
  
  // Return properly typed MangaDexSearchResult
  const searchResult: MangaDexSearchResult = {
    id: manga.id,
    title: manga.title,
    // ... other fields
    source: 'manga',
    countryOfOrigin: manga.originalLanguage,
    isLicensed: manga.isLocked !== undefined ? !manga.isLocked : undefined,
    tags,
    externalLinks,
    dateAdded: manga.createdAt,
    dateLastUpdated: manga.updatedAt
  };
  
  return searchResult;
});
```

### 10. Manga Detail Page Type Safety

In `pages/manga/[id].tsx`, we improved type safety for the manga detail page:

```typescript
// Before
const { data: manga, isLoading, refetch } = (trpc.manga?.get as any).useQuery(
  { id: mangaId ?? '' },
  { enabled: !!mangaId, retry: false }
);

// Component prop type assertions
{getProviderUrl(manga as any) && (
  <Tooltip label={`View on ${manga.source}`}>
    <ActionIcon 
      component="a" 
      href={getProviderUrl(manga as any) || '#'} 
      target="_blank"
      rel="noopener noreferrer"
      size="sm"
      variant="transparent"
      color="blue"
    >
      <IconLink size={16} />
    </ActionIcon>
  </Tooltip>
)}

// After
// Created proper types
export type MangaGetProcedure = {
  useQuery: (
    params: { id: string },
    options?: { enabled?: boolean; retry?: boolean | number }
  ) => {
    data: MangaDetailData | undefined;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
}

export type ProviderUrlManga = {
  source?: string;
  providerMetadata?: {
    id?: string;
  };
  metadata?: {
    urls?: string[];
  };
}

// Type-safe implementation
const { data: manga, isLoading, refetch } = (trpc.manga?.get as MangaGetProcedure).useQuery(
  { id: mangaId ?? '' },
  { enabled: !!mangaId, retry: false }
);

// Type-safe component props
{getProviderUrl(manga) && (
  <Tooltip label={`View on ${manga.source}`}>
    <ActionIcon 
      component="a" 
      href={getProviderUrl(manga) || '#'} 
      target="_blank"
      rel="noopener noreferrer"
      size="sm"
      variant="transparent"
      color="blue"
    >
      <IconLink size={16} />
    </ActionIcon>
  </Tooltip>
)}
```

## Benefits

These improvements provide several benefits:

1. **Compile-Time Safety**: TypeScript can now catch potential type errors during compilation
2. **Better IDE Support**: Developers get better auto-completion and type hints
3. **Self-Documenting Code**: Types serve as documentation for the expected data structures
4. **Safer Refactoring**: Changes to the codebase are less likely to introduce subtle bugs
5. **Reduced Runtime Errors**: Fewer unexpected type-related errors at runtime
6. **Better Error Messages**: More specific error messages when validation fails
7. **Increased Confidence**: Developers can have more confidence in the codebase

## Patterns and Best Practices

Throughout this work, we've established several patterns that should be followed for future development:

1. **Type Guards**: Use `in` operator, `typeof`, or `instanceof` checks to narrow types
2. **Adapter Pattern**: Create adapter functions to convert between API types and application types
3. **Explicit Null Handling**: Always handle `null` and `undefined` explicitly
4. **Type Definitions**: Create comprehensive type definitions for all data structures
5. **Utility Types**: Use TypeScript's utility types like `Partial<T>`, `Omit<T, K>`, etc.
6. **Validation Before Assertion**: Always validate data structure before type assertion
7. **Custom Type Interfaces**: Create custom interfaces for external libraries when needed
8. **Transaction Typing**: Create explicit types for database transaction clients

By following these patterns, we can continue to improve the type safety of the codebase and reduce the likelihood of runtime errors.

### 11. Library Detail Page Type Safety

In `pages/library/[id].tsx`, we improved type safety for the library detail page:

```typescript
// Before
const { data: libraryData, isLoading: isLibraryLoading } = (trpc.library?.query as any).useQuery(
  { id: libraryId ?? 0 },
  { enabled: !!libraryId }
);

<Text size="xl" fw={700}>{(libraryData as any)?.name || 'Unknown Library'}</Text>

// After
// Created proper types
export interface LibraryData {
  id: number;
  name: string;
  path: string;
  createdAt: Date;
  mangas: MangaWithRelations[];
  mangaCount: number;
  _count?: {
    mangas: number;
  };
}

export type LibraryQueryProcedure = {
  useQuery: (
    params: { id: number },
    options?: { enabled?: boolean }
  ) => {
    data: LibraryData | undefined;
    isLoading: boolean;
  };
}

// Type-safe implementation
const { data: libraryData, isLoading: isLibraryLoading } = (trpc.library?.query as LibraryQueryProcedure).useQuery(
  { id: libraryId ?? 0 },
  { enabled: !!libraryId }
);

<Text size="xl" fw={700}>{libraryData?.name || 'Unknown Library'}</Text>
```

### 12. Test Files Type Safety

In test files throughout the codebase, we improved type safety for mock objects and test fixtures:

```typescript
// Before
const ctx = createContext({
  req: { headers: {} } as any,
  res: {} as any,
  user: { id: userId, role: 'ADMIN' }
});

mockPrisma.settings.findFirst.mockResolvedValue(mockSettings as any);

const invalidInput = {
  page: -1, // Invalid page number
  pageSize: 0 // Invalid page size
} as any;

// After
// Created proper test type definitions
export interface TestApiRequest extends Partial<NextApiRequest> {
  headers: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

export interface TestUserContext {
  id: string;
  role: UserRole;
  [key: string]: unknown;
}

export interface TestAniListSettings {
  id: number;
  metadata: string;
  [key: string]: unknown;
}

// Type-safe implementation
const ctx = createContext({
  req: { headers: {} } as TestApiRequest,
  res: {} as TestApiResponse,
  user: { id: userId, role: 'ADMIN' } as TestUserContext
});

mockPrisma.settings.findFirst.mockResolvedValue(mockSettings as TestAniListSettings);

// Type-safe test input validation
interface ListInputParams {
  page?: number;
  pageSize?: number;
}

const invalidInput: ListInputParams = {
  page: -1, // Invalid page number
  pageSize: 0 // Invalid page size
};
```