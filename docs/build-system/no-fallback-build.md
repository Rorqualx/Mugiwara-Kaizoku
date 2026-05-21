# No Fallback Build

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for No Fallback Build

---
# Next.js Build Without Fallback

This document describes the new build system for Mugiwara-Kaizoku that creates a complete Next.js build without relying on fallback mechanisms.

## Problem Statement

The previous build system had issues with ESM compatibility and would sometimes fall back to a simplified Express server when the Next.js build failed. The fallback provided reduced functionality and was only intended as a temporary workaround.

## Solution

We have implemented a new build script (`scripts/no-fallback-build.sh`) that:

1. Avoids Babel configuration issues by relying on Next.js's built-in SWC compiler
2. Provides a simplified Next.js configuration focused on ESM compatibility
3. Properly handles problematic packages like `@trpc/client` and `@tabler/icons-react`
4. Enforces a full Next.js build without allowing fallback to Express

## Key Changes

1. **Removed Babel Configuration**: 
   - The build script removes any `.babelrc` files that might interfere with Next.js's built-in SWC compiler.
   - This prevents JSON parsing errors during the build process.

2. **Simplified Next.js Configuration**:
   - Created a more straightforward `next.config.mjs` that avoids problematic webpack plugins.
   - Used `transpilePackages` to properly handle ESM modules.
   - Set `esmExternals: 'loose'` for better ESM compatibility.

3. **Tabler Icons Handling**:
   - Runs the `transform-tabler-imports.js` script to convert direct imports to use a wrapper module.
   - This avoids ESM compatibility issues with the `@tabler/icons-react` package.

4. **Strict Startup Validation**:
   - Modified `prod-start.sh` to verify a complete Next.js build exists before starting.
   - Checks for the presence of `BUILD_ID` and `webpack-runtime.js` to ensure a proper build.
   - Fails early with a clear error message if a fallback build is detected.

## Usage

```bash
# Build the application with no fallback
npm run build

# Start the production server
npm run start
```

## Verification

To verify you're running the proper Next.js server (not a fallback):

1. Check the server startup logs - it should show "Starting Next.js production server" without any fallback warnings.
2. The server should serve all routes defined in your Next.js application.
3. Dynamic API routes should work correctly.

## Troubleshooting

If you encounter build failures:

1. **Webpack Plugin Errors**:
   - These are typically caused by problematic import statements or webpack plugin configurations.
   - Check the console output for specific errors and the affected files.

2. **ESM Compatibility Issues**:
   - Look for errors related to `@trpc/client` or other ESM packages.
   - The build script should handle these automatically, but new dependencies might need to be added to the `transpilePackages` list.

3. **Missing Build Files**:
   - If the startup script reports missing build files, make sure you've run `npm run build` and it completed successfully.
   - Check the `.next` directory to ensure it contains all necessary files.

## Benefits Over Previous Approach

1. **Full Functionality**: The full Next.js server provides all features, including API routes, server-side rendering, and optimized assets.
2. **Better Performance**: The proper Next.js build includes optimizations for production that the fallback server lacked.
3. **Reliability**: By enforcing a complete build, we avoid partial functionality and ensure a consistent experience.
4. **Maintainability**: Following standard Next.js patterns makes the codebase more maintainable and easier to update.