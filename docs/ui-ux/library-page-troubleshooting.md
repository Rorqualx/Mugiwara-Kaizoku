# Library Page Troubleshooting Guide

## Issue: "Unknown Library" displaying instead of library name

### Problem
The library page was displaying "Unknown Library" instead of the actual library name, even though the library data was being successfully queried from the database.

### Root Cause
Several issues were identified:

1. **API Endpoint Mismatch**: The component was using `trpc.library?.query` which doesn't accept an ID parameter in the current router implementation, but the component was passing an ID.

2. **Router Implementation Conflict**: At the time of the bug, two different library router implementations existed in the codebase. The authoritative router is:
   - `/src/server/trpc/routers/library.ts`
   
   The component was calling a query procedure that doesn't match the implementation that's actually being used.

3. **Type Casting Issues**: The component was using type assertions (`as unknown as LibraryQueryProcedure`) which masked the underlying mismatch.

4. **Insufficient Null Checking**: There was minimal null checking when accessing the library name, which could cause "Unknown Library" to appear even if some data was available.

### Solution

1. **Fix API Call**: Changed from using `trpc.library?.query` to `trpc.library.get.useQuery` which correctly accepts an ID parameter and exists in the actual router implementation.

2. **Improve Error Handling**: Added detailed error messages to help identify issues when libraries can't be found.

3. **Enhanced Null Checking**: Added more comprehensive null checks to ensure robust handling of potentially missing data:
   ```tsx
   <Text size="xl" fw={700}>{libraryData && libraryData.name ? libraryData.name : 'Unknown Library'}</Text>
   ```

4. **Added Data Structure Inspection**: Added success and error callbacks to log the actual data structure being returned.

5. **Consistent API Return Format**: Updated the library router to ensure it returns the expected structure with `mangaCount` property.

## Testing the Fix

1. Navigate to a library page in your application
2. Check the browser console for logs showing the fetched library data
3. Verify that the library name is displayed correctly
4. Try accessing libraries with different IDs to ensure they all work

## Preventive Measures

1. **Consolidate Router Implementations**: Consider merging the two library router implementations to avoid confusion.

2. **Type Safety**: Use proper TypeScript interfaces without resorting to type assertions.

3. **Standardized API Structures**: Ensure all API endpoints return consistently structured data.

4. **Robust Error Handling**: Always include comprehensive error handling and fallbacks in UI components.

## Related Files

- `/src/pages/library/[id].tsx` - Library page component
- `/src/server/trpc/routers/library.ts` - Library router with `get` endpoint
- `/src/types/library-page-types.ts` - Type definitions for library data

## Log Analysis

When debugging similar issues in the future, look for:
- Console errors about undefined properties
- TRPC errors about invalid procedure calls
- Database query errors
- Type mismatch warnings in development