# Dev Environment Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Dev Environment Fixes

---
# Development Environment Fixes

This document provides a detailed explanation of the fixes implemented to resolve module compatibility issues in the Mugiwara-Kaizoku development environment.

## Overview of Issues Fixed

1. **ESM vs CommonJS Module Conflict**
   - Next.js 14 with `"type": "module"` in package.json caused conflicts with CommonJS modules
   - Fixed tabler-icons-wrapper.js to use ESM exports
   - Added error handling for module resolution

2. **next-auth Compatibility Issues**
   - next-auth v5 beta (5.0.0-beta.28) has compatibility issues with ESM modules
   - Implemented a temporary solution to use next-auth v4 instead
   - Created patches to ensure proper integration with the application

3. **tRPC Client Integration Problems**
   - React Query integration with tRPC was causing errors
   - Created monkey patches to provide stub implementations of missing methods
   - Fixed specific component issues with trpc.useContext()

## Implementation Details

### 1. ESM Module Fixes

The project uses ESM modules (`"type": "module"` in package.json), but some files were using CommonJS syntax:

```javascript
// Before (CommonJS)
module.exports = { /* exports */ };

// After (ESM)
export default { /* exports */ };
export { /* named exports */ };
```

### 2. next-auth Fixes

We downgraded next-auth from v5 beta to v4 stable to fix compatibility issues:

```bash
npm install next-auth@4.24.5
```

### 3. tRPC Monkey Patching

Created a comprehensive monkey patch for tRPC client with stub implementations:

1. Created stub implementations for common hooks:
   - `useQuery`
   - `useContext`
   - `useMutation`

2. Used JavaScript Proxy to intercept property access:
   ```javascript
   const trpc = new Proxy(originalTrpc, {
     get(target, prop) {
       // Return stub implementations for missing methods
     }
   });
   ```

3. Fixed specific component issues:
   - `IntegrationStatusContext.tsx` - Added null safety for `trpc.useContext()`

## How to Use the Fixes

1. **Run the Patched Development Server**:
   ```bash
   ./scripts/run-patched-dev.sh
   ```

   This script will:
   - Install next-auth v4
   - Apply all necessary patches
   - Start the development server

2. **Understanding What's Happening**:
   - The script patches import statements to use our monkey-patched tRPC client
   - It fixes tabler-icons-wrapper.js to use ESM exports
   - It replaces IntegrationStatusContext.tsx with a more resilient version

## Troubleshooting

If you encounter issues:

1. **Module Resolution Errors**:
   - Check import statements are correctly pointing to patched versions
   - Ensure all files are using ESM module syntax

2. **React Query Errors**:
   - These are typically related to tRPC integration
   - Check the console for specific error messages
   - May require additional monkey patching for specific components

3. **Database Connection Issues**:
   - These are unrelated to our module fixes
   - Refer to the main project documentation for database setup

## Future Improvements

These fixes are temporary workarounds to get the development environment running. Long-term solutions include:

1. **Proper ESM Migration**:
   - Update all files to use consistent ESM syntax
   - Replace legacy CommonJS patterns throughout the codebase

2. **next-auth Upgrade Strategy**:
   - Wait for next-auth v5 to stabilize
   - Follow official migration guide to upgrade properly

3. **tRPC Client Refactoring**:
   - Reimplement tRPC client integration without monkey patching
   - Use official patterns for React Query integration

## References

- [Next.js Module Resolution](https://nextjs.org/docs/app/building-your-application/configuring/typescript#module-resolution)
- [ESM vs CommonJS](https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs)
- [next-auth Documentation](https://next-auth.js.org/)
- [tRPC Documentation](https://trpc.io/docs/)