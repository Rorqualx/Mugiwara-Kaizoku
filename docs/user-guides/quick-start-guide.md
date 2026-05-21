# Quick Start Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Quick Start Guide

---
# Quick Start Guide

This guide provides a quick overview of how to get the Mugiwara-Kaizoku application running in development mode.

## Running the Application

We've created two scripts to help you run the application:

1. **Basic Development Server**:
   ```bash
   ./scripts/start-dev.sh
   ```
   This script:
   - Sets up the database
   - Fixes the tabler-icons-wrapper.js module
   - Starts the Next.js development server on port 3002

2. **Fully Patched Development Server**:
   ```bash
   ./scripts/run-patched-dev.sh
   ```
   This script provides more comprehensive fixes:
   - Installs next-auth v4 (stable version)
   - Applies tRPC monkey patches
   - Fixes all ESM compatibility issues
   - Provides stub implementations for missing methods
   - Replaces problematic components with patched versions
   - Starts the development server on port 3002

## Troubleshooting Common Issues

### Module is not defined

If you see `ReferenceError: module is not defined` errors:
- This is caused by mixing CommonJS and ESM module systems
- We've fixed the most common occurrences
- For new instances, convert `module.exports = ...` to `export default ...`

### Cannot find module errors

For errors like `Cannot find module '.../node_modules/next/server'`:
- These are typically related to next-auth v5 compatibility issues
- The patched development script installs next-auth v4 instead
- If you need to manually fix: `npm install next-auth@4.24.5`

### tRPC function is not defined

For errors like `TypeError: trpc.useContext is not a function`:
- These are caused by missing tRPC methods
- We've created a monkey patch that provides stub implementations
- Import from `'../utils/trpc-monkey-patch'` instead of `'../utils/trpcClient'`

## Accessing the Application

Once running, the application is available at:
- **URL**: http://localhost:3002
- **Default credentials**: Refer to your .env file or project documentation

## Next Steps

After getting the development environment running:

1. **Explore the Codebase**:
   - Key directories: `src/api`, `src/components`, `src/hooks`
   - Main application file: `src/pages/_app.tsx`

2. **Read Documentation**:
   - [Development Guide](./development-guide.md): More detailed development information
   - [Dev Environment Fixes](./dev-environment-fixes.md): Explanation of all applied fixes

3. **Long-term Solutions**:
   - Consider a full migration to ESM or CommonJS for consistency
   - Update to stable versions of dependencies when available
   - Replace monkey patches with proper implementations

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs/)
- [next-auth Documentation](https://next-auth.js.org/)
- [ESM vs CommonJS](https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs)