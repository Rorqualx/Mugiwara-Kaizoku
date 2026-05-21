# Build System Improvement

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build System Improvement

---
# Build System Improvement

## Overview

This document details the improvements made to the Mugiwara-Kaizoku build system to eliminate dependency on wrapper files and create a more robust build process.

## Problem

The current build process relies heavily on runtime wrappers for tRPC and other packages:

1. During the build, it creates temporary wrapper files for:
   - `@tabler/icons-react`
   - `@trpc/client`
   - `@trpc/client/unstable-internals`
   - `@trpc/react-query`
   - `@trpc/react-query/shared`

2. These wrappers are used to bypass dependency issues during the build process, but they introduce complexity and potential points of failure.

3. The build frequently fails with errors like:
   ```
   Module not found: Can't resolve '@trpc/react-query/shared'
   Module not found: Can't resolve '@trpc/client/unstable-internals'
   ```

4. The current solution relies on a fallback to a minimal build that doesn't fully test the production configuration.

## Solution

We've implemented a more robust build approach that eliminates the need for wrapper files:

1. **Direct tRPC Implementation**:
   - Created `src/utils/trpc-client/direct-export.ts` that directly exports the tRPC functionality
   - Added a simplified `_app.direct.tsx` that uses the direct exports

2. **Simplified Build Process**:
   - Created a new build script `robust-nextjs-build.sh` that:
     - Uses the direct implementation temporarily during build
     - Avoids all the wrapper files from the previous approach
     - Maintains the same optimized webpack configuration
     - Still falls back to the minimal build if needed, but should succeed more often

3. **Implementation Details**:
   - Temporarily replaces `_app.tsx` with `_app.direct.tsx` during build
   - Uses an optimized Next.js config that includes necessary transpilation
   - Restores original files after build completion

## Usage

To use the new build system:

```bash
npm run build:robust
# or
./scripts/robust-nextjs-build.sh
```

## Benefits

1. **Simplified Build Process**: Eliminates the need for complex wrapper files
2. **Improved Reliability**: Reduces points of failure in the build pipeline
3. **Better Maintainability**: Makes the build process easier to understand and debug
4. **Consistent Output**: Produces a more consistent build result that better matches development

## Implementation

The implementation consists of three key files:

1. `src/utils/trpc-client/direct-export.ts`: Direct export of tRPC functionality
2. `src/pages/_app.direct.tsx`: Alternative app component using direct exports
3. `scripts/robust-nextjs-build.sh`: Build script that uses the direct implementation

## Future Improvements

1. **Package Upgrades**: Consider upgrading tRPC and related packages to versions with better build-time compatibility
2. **ESM Modules**: Move more of the codebase to use ESM modules for better compatibility
3. **Build Performance**: Investigate strategies to improve build performance and reliability

## Conclusion

This solution provides a more robust approach to building the application without relying on temporary wrapper files. It should result in more consistent builds and a more maintainable build process going forward.