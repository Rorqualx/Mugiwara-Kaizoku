# Library Deletion Config Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Library Deletion Config Fix

---
# Library Deletion and ConfigService Initialization Fixes

## Date: June 30, 2025

## Issues Identified

1. **ConfigService Not Initialized**
   - Error: "Global ConfigService not initialized. Call setGlobalConfigService first."
   - The ConfigService was created but never initialized with `setGlobalConfigService`

2. **Library Deletion Disabled**
   - The library deletion functionality was commented out in the `LibraryList` component
   - A dummy implementation was used instead of the actual tRPC mutation

3. **Other Warnings** (informational, not fixed)
   - "next start" doesn't work with "output: standalone" configuration
   - Java version 1.8.0_25 is too old for Suwayomi (requires Java 11+)
   - Deprecated files still in use (prismaTypes.ts, typescript-compat.ts)

## Fixes Applied

### 1. ConfigService Initialization

**File**: `src/server/trpc/context.ts`
- Added import statements for ConfigService and setGlobalConfigService
- Added initialization logic in `createContext` function
- The ConfigService is now initialized on the first tRPC request
- Added error handling to continue operation if initialization fails (non-critical)

**File**: `src/server/expressContext.ts`
- Added the same initialization logic for Express context
- Uses async initialization to avoid blocking requests

### 2. Library Deletion Re-enabled

**File**: `src/components/library/LibraryList.tsx`
- Removed the commented-out tRPC mutation and dummy implementation
- Re-enabled the proper tRPC mutation: `trpc.library.delete.useMutation()`
- The deletion functionality should now work properly

## How the Fixes Work

1. **ConfigService Initialization**:
   - When the first tRPC request is made, the context creation function checks if ConfigService is initialized
   - If not, it calls `configService.initialize()` and then `setGlobalConfigService(configService)`
   - This ensures all subsequent configuration requests will work properly

2. **Library Deletion**:
   - The `LibraryList` component now uses the actual tRPC mutation
   - When a user clicks delete on a library, it will call the backend delete endpoint
   - The backend endpoint in `src/server/trpc/router/library.ts` already has the delete logic implemented

## Testing the Fixes

1. Restart the application: `npm run dev`
2. Navigate to the libraries page
3. Try deleting a library - it should now work
4. Check the console logs - you should see "ConfigService initialized successfully"

## Remaining Issues (Not Fixed)

1. **Java Version**: Update Java to version 11 or higher for Suwayomi support
2. **Standalone Mode**: Use `node .next/standalone/server.js` instead of `next start`
3. **Deprecated Files**: Consider migrating away from deprecated files in future updates
