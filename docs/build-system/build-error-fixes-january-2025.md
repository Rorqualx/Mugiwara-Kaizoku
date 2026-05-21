# Build Error Fixes January 2025

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build Error Fixes January 2025

---
# Build Error Fixes Summary (Updated)

## Build Command Rule Enforcement

### Critical Rule
There is **ONLY ONE** build command that should ever be used:
- ✅ `pnpm build:clean` - The comprehensive clean build script

### Removed Commands
The following build commands have been removed to prevent confusion:
- ❌ `build:clean:fixed` - Removed from package.json
- ❌ `build:smart` - Removed from package.json
- ❌ `scripts/build-clean-fixed.sh` - Deleted
- ❌ `scripts/smart-build-clean.sh` - Deleted

### Updates Made
1. **CLAUDE.md** - Added explicit rule at the top of the file stating only `pnpm build:clean` should be used
2. **package.json** - Removed alternative build commands
3. **Scripts directory** - Deleted unused build scripts

---

## Issues Identified

1. **KAIZOKU_LOG_PATH Error**
   - Error: `TypeError: Cannot read properties of undefined (reading 'KAIZOKU_LOG_PATH')`
   - Cause: Environment variables were being accessed before proper initialization during the build process
   - Location: Logger configuration files

2. **prismaTypes.ts Warning**
   - Warning: `[TRANSITIONAL] prismaTypes.ts is being transitioned to the new standardized type system`
   - Cause: Console warning being executed during build time
   - Location: `/src/types/prismaTypes.ts`

## Fixes Applied

### 1. Logger Configuration Updates

Updated three logger files to handle environment variable loading gracefully:

#### `/src/utils/logging/logger.ts`
- Added safe environment variable access with fallbacks
- Wrapped logger initialization in try-catch block
- Falls back to console logging if initialization fails
- Uses dynamic require() to safely load validateEnv

#### `/src/utils/serverLogger.ts`
- Added getEnv() helper function for safe environment access
- Provides default values when validateEnv fails to load
- Wrapped logger initialization in try-catch block
- Falls back to basic pino logger if initialization fails

#### `/src/utils/server-logger.ts`
- Added try-catch around env/server import
- Falls back to process.env with defaults if import fails
- Added error handling for pino-pretty dependency
- Ensures logger always initializes even if dependencies fail

### 2. PrismaTypes Warning Suppression

#### `/src/types/prismaTypes.ts`
- Modified console.warn to only execute during runtime
- Added checks for:
  - `typeof window !== 'undefined'` (client-side check)
  - `process.env.NODE_ENV !== 'production'` (development check)
  - `!process.env.NEXT_PHASE` (not during build phase)
- Warning now only shows in development runtime, not during build

### 3. Environment Variable Configuration

#### `.env`
- Added `KAIZOKU_LOG_PATH=./logs` to provide the required environment variable

#### `.env.example`
- Added documentation for `KAIZOKU_LOG_PATH` with:
  - Default value: `./logs`
  - Usage description
  - Note about automatic directory creation

## Results

These fixes should resolve:
1. The server-side logging initialization errors during build
2. The repetitive prismaTypes.ts warnings during build
3. Provide proper fallbacks for missing environment variables

## Testing

To verify the fixes:
1. Run `pnpm build:clean` - Should complete without the mentioned errors
2. Run `pnpm dev` - Should start without logging errors
3. Check that logs directory is created (if it doesn't exist)
4. Verify that the prismaTypes warning only appears once in development runtime

## Next Steps

1. Consider migrating code to use the new domain types as suggested by the warning
2. Monitor for any other environment variable access issues during build
3. Ensure all environment-dependent code has proper fallbacks for build time

## Important Note

**Build Command**: The ONLY build command that should be used is `pnpm build:clean`. Do not use any other build variations or create new build commands.
