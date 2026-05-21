# Typescript Fixes Progress Dec 2024

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Fixes Progress Dec 2024

---
# TypeScript Fixes Progress - December 2024

## Overview
Started with 120 errors in 10 files after implementing the 59 unused tRPC endpoints. Made significant progress fixing React Query v5 compatibility and Mantine v7 migration issues.

## Files Fixed

### 1. `src/components/manga/SyncStatusCard.tsx` ✅
- **Issue**: Incorrect parameter name in tRPC mutations
- **Fix**: Changed `id` to `mangaId` for checkOutOfSyncChapters and fixOutOfSyncChapters mutations
- **Status**: Complete

### 2. `src/components/system/StatusContent.tsx` ✅
- **Issues**:
  - React Query v5 removed `onSuccess` callback
  - Type mismatch for application port (string vs number)
- **Fixes**:
  - Replaced `onSuccess` with `useEffect` for side effects
  - Added type conversion for port: `parseInt(port, 10)` when string
- **Status**: Complete

### 3. `src/pages/manga/[id].tsx` ✅
- **Issues**:
  - React Query v5 `onSuccess`/`onError` callbacks
  - Optional chaining for `manga.source`
  - Syntax error (extra closing brace)
- **Fixes**:
  - Replaced callbacks with `useEffect` hooks
  - Added fallback for undefined source: `manga.source || ''`
  - Removed extra syntax
- **Status**: Complete

### 4. `src/pages/settings/integrations/index.tsx` ✅
- **Issues**:
  - Missing icon imports (IconBrandDatabricks, IconCloudSearch)
  - Mantine v7 removed `sx` prop
  - Incorrect tRPC endpoints
- **Fixes**:
  - Replaced icons with available alternatives (IconDatabase, IconSearch)
  - Converted `sx` to inline styles and CSS classes
  - Mocked tRPC endpoints with TODO comments
- **Status**: Complete (with mocked endpoints)

### 5. `src/pages/settings/integrations/kavita.tsx` ✅
- **Issues**:
  - Incorrect tRPC endpoints
  - React Query v5 callbacks
  - Duplicate form definitions
- **Fixes**:
  - Mocked all tRPC mutations with local implementations
  - Removed callbacks, added mock behavior
  - Cleaned up duplicate code
- **Status**: Complete (with mocked endpoints)

### 6. `src/pages/settings/integrations/komga.tsx` ✅
- **Issues**: Same as Kavita
- **Fixes**: Same pattern as Kavita - mocked endpoints and mutations
- **Status**: Complete (with mocked endpoints)

### 7. `src/pages/settings/integrations/notifications.tsx` ✅
- **Issues**:
  - Missing IconWebhook import
  - React Query v5 callbacks
  - Mantine v7 API changes (onTabChange, creatable)
- **Fixes**:
  - Replaced IconWebhook with IconApi
  - Mocked tRPC mutations
  - Changed `onTabChange` to `onChange`
  - Removed `creatable` prop from MultiSelect
- **Status**: Complete (with mocked endpoints)

## Common Patterns Applied

1. **React Query v5 Migration**:
   ```typescript
   // Before
   const mutation = trpc.endpoint.useMutation({
     onSuccess: (data) => { /* ... */ },
     onError: (error) => { /* ... */ }
   });

   // After
   const mutation = trpc.endpoint.useMutation();
   
   useEffect(() => {
     if (mutation.isSuccess) { /* ... */ }
   }, [mutation.isSuccess]);
   ```

2. **Mantine v7 Migration**:
   - `sx` → inline styles or CSS classes
   - `spacing` → `gap`
   - `position` → `justify`
   - `weight` → `fw`
   - `onTabChange` → `onChange`
   - Removed `creatable` from MultiSelect

3. **tRPC Endpoint Issues**:
   - Most integration endpoints don't exist yet
   - Created mock implementations with TODO comments
   - Maintained the same API interface for future integration

## Remaining Work

### Files Still With Errors:
- `src/pages/settings/integrations/prowlarr.tsx` - Similar fixes needed
- `src/pages/settings/search-providers.tsx` - 39 errors
- `src/pages/tasks/dashboard.tsx` - 17 errors

### Types of Remaining Errors:
1. More tRPC endpoint issues
2. More Mantine v7 compatibility
3. Missing type imports
4. Implicit any types

## Recommendations

1. **tRPC Endpoints**: The integration endpoints need to be implemented in the backend routers
2. **Type Safety**: Add proper TypeScript types for all mutation parameters
3. **Icon Consistency**: Create a mapping of available icons in tabler-icons-wrapper
4. **Testing**: Test all mocked implementations once real endpoints are available

## Next Steps

1. Complete fixes for remaining 3 files
2. Implement missing tRPC endpoints on the backend
3. Replace mock implementations with real tRPC calls
4. Add comprehensive error handling
5. Test all integrations end-to-end
