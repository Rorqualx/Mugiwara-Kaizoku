# Page Component Fixes Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Page Component Fixes Plan

---
# Page Component Fixes Implementation Plan

## Overview

This document outlines the detailed strategy for fixing TypeScript errors in the React page components. The goal is to ensure type safety, consistent implementation patterns, and proper error handling across all page components.

## Files Requiring Fixes

1. **Home and Login Pages**
   - `src/pages/index.tsx` (2 errors)
   - `src/pages/login.tsx` (2 errors)

2. **Library Pages**
   - `src/pages/library/[id].tsx` (5 errors)
   - `src/pages/library/add.tsx` (potential errors)

3. **Manga Detail Pages**
   - `src/pages/manga/[id].tsx` (2 errors)

4. **Settings Pages**
   - `src/pages/settings/general.tsx` (4 errors)
   - `src/pages/settings/indexers.tsx` (2 errors)

5. **System Pages**
   - `src/pages/system/events.tsx` (4 errors)
   - `src/pages/system/logs.tsx` (7 errors)

6. **Task Pages**
   - `src/pages/tasks/active.tsx` (3 errors)
   - `src/pages/tasks/failed.tsx` (1 error)
   - `src/pages/tasks/queued.tsx` (1 error)
   - `src/pages/tasks/scheduled.tsx` (1 error)

## Common Error Patterns

1. **Import Path Issues**
   - Using incorrect import paths
   - Importing from old or deprecated modules
   - Missing imports for type definitions

2. **Domain Type Compatibility**
   - Type mismatches between different versions of domain types
   - Inconsistent use of namespaces (DomainTypes vs Domain)
   - Unsafe type assertions

3. **Component Prop Type Issues**
   - Missing prop type definitions
   - Incompatible prop types between parent and child components
   - Optional prop handling errors

4. **Event Handler Type Safety**
   - Missing type definitions for event handlers
   - Incorrect event types in callbacks
   - Type errors in form handling

## Implementation Strategy

### 1. Fix Domain Type Imports

Many of the errors stem from inconsistent import paths and namespace usage. The key fixes needed are:

1. **Standardize Domain Type Imports**:
   ```typescript
   // Replace this:
   import { DomainTypes } from "../../types/domain-types";

   // With this standardized import:
   import { Domain } from "../../types/domain";
   ```

2. **Update Type References**:
   ```typescript
   // Replace all references to DomainTypes namespace:
   const library: DomainTypes.LibraryEntity = ...

   // With the standardized Domain namespace:
   const library: Domain.LibraryEntity = ...
   ```

### 2. Fix Library Page Issues (`src/pages/library/[id].tsx`)

The library page has type issues with the manga card mapping and domain type compatibility:

1. **Fix Type for MangaWithChapters**:
   ```typescript
   // Replace this:
   {Array.isArray(libraryManga) && libraryManga.map((manga: DomainTypes.MangaWithChapters) => (

   // With properly typed iteration:
   {Array.isArray(libraryManga) && libraryManga.map((manga: Domain.MangaEntity & { chapters?: Domain.ChapterEntity[] }) => (
   ```

2. **Improve ID Type Safety**:
   ```typescript
   // Replace direct string conversion:
   const libraryId = typeof id === 'string' ? parseInt(id, 10) : undefined;

   // With safer ID handling:
   const libraryId = id && typeof id === 'string' && !isNaN(parseInt(id, 10)) 
     ? parseInt(id, 10) 
     : undefined;
   ```

3. **Fix Optional Chaining**:
   ```typescript
   // Fix potentially undefined library access:
   <Text size="xl" fw={700}>{library && library.name ? library.name : 'Unknown Library'}</Text>
   ```

### 3. Fix Manga Detail Page (`src/pages/manga/[id].tsx`)

The manga detail page has issues with event handlers and props:

1. **Fix Event Handler Types**:
   ```typescript
   // Add proper types for event handlers:
   const handleRemove = useCallback((shouldRemoveFiles: boolean) => {
     // Implementation...
   }, [mangaId, router]);
   ```

2. **Fix Component Prop Types**:
   ```typescript
   // Ensure correct prop types for components:
   <MangaDetail
     manga={manga as Domain.MangaEntity}
     onRefresh={handleRefresh}
     onUpdate={handleUpdate}
     onRemove={handleRemove}
   />
   ```

### 4. Fix Settings Pages

The settings pages have issues with form handling and component props:

1. **Fix Form Event Handlers**:
   ```typescript
   // Add proper types for form event handlers:
   const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
     event.preventDefault();
     // Implementation...
   }, [formData]);
   ```

2. **Fix Component Prop Types**:
   ```typescript
   // Ensure correct typing for component props:
   <SettingsForm
     settings={settings as Domain.SettingsEntity}
     onChange={handleChange}
     onSubmit={handleSubmit}
   />
   ```

### 5. Fix System and Task Pages

These pages have issues with data fetching and type compatibility:

1. **Fix API Result Types**:
   ```typescript
   // Add proper typing for API results:
   interface ApiResult<T> {
     data?: T;
     error?: string;
     status: 'success' | 'error' | 'loading';
   }
   
   // Use the typed result:
   const eventsQuery = trpc.events.getAll.useQuery<ApiResult<Domain.EventEntity[]>>(
     undefined,
     {
       refetchInterval: 30000,
     }
   );
   ```

2. **Fix Data Mapping**:
   ```typescript
   // Add proper type guards for data mapping:
   const events = eventsQuery.data?.data;
   
   {Array.isArray(events) && events.map((event) => (
     <EventItem key={event.id} event={event} />
   ))}
   ```

## Implementation Steps for Each Page Type

### 1. Fix Pages with Authentication

For pages with authentication (index.tsx, login.tsx):

1. **Update Authentication Types**:
   ```typescript
   // Create a custom type for the session user
   type SessionUser = {
     id: string;
     name?: string;
     email?: string;
     role?: Domain.UserRole;
     avatar?: string;
   };
   
   // Add a type guard for the session user
   function isSessionUser(user: unknown): user is SessionUser {
     return user !== null && 
       typeof user === 'object' && 
       'id' in user;
   }
   
   // Use the type guard in the component
   const sessionUser = session?.user;
   if (isSessionUser(sessionUser)) {
     // Safe to use sessionUser
   }
   ```

2. **Fix Type Assertions**:
   ```typescript
   // Replace direct type assertion:
   const user = session?.user as Domain.UserEntity | null;
   
   // With safer conversion:
   const user = session?.user ? {
     id: session.user.id || '',
     username: session.user.name || '',
     email: session.user.email || '',
     role: (session.user.role as Domain.UserRole) || 'USER',
     // ... other properties
   } as Domain.UserEntity : null;
   ```

### 2. Fix Pages with Dynamic Routing

For pages with dynamic routing (library/[id].tsx, manga/[id].tsx):

1. **Fix Router Query Types**:
   ```typescript
   // Add type safety for router queries
   const { id } = router.query;
   const itemId = id && typeof id === 'string' ? id : undefined;
   
   // For numeric IDs, add conversion with validation
   const numericId = itemId && !isNaN(parseInt(itemId, 10)) 
     ? parseInt(itemId, 10) 
     : undefined;
   ```

2. **Add Error Handling for Missing IDs**:
   ```typescript
   // Add error handling for missing or invalid IDs
   useEffect(() => {
     if (!itemId) {
       console.error('Invalid ID in URL');
       router.push('/404');
     }
   }, [itemId, router]);
   ```

### 3. Fix Pages with Data Tables

For pages with data tables (tasks/active.tsx, events.tsx, logs.tsx):

1. **Fix Data Row Types**:
   ```typescript
   // Add proper row type definitions
   type LogRow = {
     id: string;
     timestamp: string;
     level: string;
     message: string;
     details?: Record<string, unknown>;
   };
   
   // Use the type in the data table
   const rows = logs?.map((log: LogRow) => (
     <tr key={log.id}>
       <td>{log.timestamp}</td>
       <td>{log.level}</td>
       <td>{log.message}</td>
     </tr>
   ));
   ```

2. **Improve Error Handling**:
   ```typescript
   // Add better error handling for data loading
   if (isError) {
     return (
       <Center>
         <Stack align="center">
           <Text color="red">Error loading data</Text>
           <Text size="sm">{error instanceof Error ? error.message : 'Unknown error'}</Text>
         </Stack>
       </Center>
     );
   }
   ```

## Verification Steps

After implementing the fixes, verify:

1. Run TypeScript checks to ensure no new errors are introduced
2. Test each page to ensure it renders correctly
3. Verify that all interactions work as expected
4. Check that error states are handled properly

## Benefits of Implementation

Implementing these fixes will:

1. Improve type safety across all page components
2. Ensure consistent use of domain types throughout the application
3. Reduce runtime errors through stronger type checking
4. Make the codebase more maintainable with clearer type definitions
5. Provide a better developer experience through improved type inference