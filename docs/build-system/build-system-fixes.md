# Build System Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build System Fixes

---
# Build System Fixes

This document explains the issues with the build system and the solutions that have been implemented.

## Issues

The build system had several issues:

1. **Tabler Icons ESM Compatibility**: The project uses `@tabler/icons-react` version 3.31.0, which is an ESM-only package. The build system was attempting to use these icons in a CommonJS context, leading to compatibility issues.

2. **Next.js ESM Module Issues**: The Next.js build process had issues with ESM modules, particularly with dynamic imports and module loading. This resulted in errors like `ERR_INTERNAL_ASSERTION: Unexpected module status 5`.

3. **ESM vs CommonJS Conflicts**: The package.json has `"type": "module"`, which means all .js files are treated as ES modules, but some scripts were using CommonJS syntax (require/module.exports).

4. **Complex Build Process**: The build system had multiple scripts and approaches, making it difficult to diagnose and fix issues.

## Solutions

We've implemented the following solutions:

### 1. Improved Icon Wrapper

Created a proper wrapper for Tabler icons that works in both development and production:

- `src/utils/tabler-icons-wrapper.ts`: A simple file that re-exports all icons from `@tabler/icons-react`
- `scripts/generate-icon-wrapper.mjs`: A script that generates the appropriate icon wrapper for the build environment (using ESM syntax with .mjs extension)

### 2. Next.js Configuration Updates

Updated the Next.js configuration to better handle ESM modules:

- Changed `experimental.esmExternals` from `'loose'` to `true` for better ESM compatibility
- Updated webpack aliases to point to our local wrapper files
- Simplified the configuration to focus on the core issues

### 3. New Build Script

Created a new build script that handles the icon wrapper and ESM compatibility:

- `scripts/fixed-build.sh`: A simplified build script that generates the icon wrapper and builds the project

### 4. Improved Production Start Script

Created an improved production start script that handles Docker and database setup:

- `scripts/prod-start-fixed.sh`: A more robust production start script that checks for Docker and database availability

## How to Use

1. **Building the Project**:
   ```bash
   pnpm build
   ```
   This will use the new fixed build script.

2. **Starting in Production**:
   ```bash
   pnpm start
   ```
   To start without Docker:
   ```bash
   pnpm start -- --no-docker
   ```

## Additional Notes

- The build system now properly handles ESM modules and Tabler icons
- The production start script is more robust and handles different environments
- The configuration is simpler and more focused on the core issues

These changes should resolve the build issues and make the system more reliable.