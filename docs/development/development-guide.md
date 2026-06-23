# Development Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Development Guide

---
# Mugiwara-Kaizoku Development Guide

This guide provides solutions for common development environment issues and recommendations for working with the codebase.

## Quick Start

To run the development environment with all patches applied:

```bash
# Run the patched development server
./scripts/run-patched-dev.sh

# Access the application
# Open http://localhost:3000 in your browser
```

## Common Issues and Solutions

### 1. Module Resolution Errors

**Issue**: `ReferenceError: module is not defined` in tabler-icons-wrapper.js

**Solution**:
- The project uses ESM modules (`"type": "module"` in package.json)
- We've patched tabler-icons-wrapper.js to use ESM syntax
- Additional files may need similar conversions from CommonJS to ESM

### 2. next-auth Compatibility Issues

**Issue**: `Cannot find module '.../node_modules/next/server'`

**Solution**:
- We've downgraded next-auth from v5 beta to v4 stable
- This is a temporary solution until next-auth v5 becomes more stable
- The patch script installs next-auth v4.24.5

### 3. tRPC Integration Problems

**Issue**: Errors with `trpc.useContext()` and other tRPC hooks

**Solution**:
- Created a monkey patch for tRPC client with stub implementations
- Modified components to handle missing tRPC methods gracefully
- Applied defensive programming techniques to prevent runtime errors

## Development Workflow

1. **Start Development Server**:
   ```bash
   ./scripts/run-patched-dev.sh
   ```

2. **Making Changes**:
   - Edit files as normal
   - If you encounter new module errors, they may need similar patching
   - Check the browser console for specific error messages

3. **Adding New Components**:
   - Follow the patterns in the patched files
   - Use defensive programming (null checks, try/catch)
   - Import from patched modules (e.g., `trpc-monkey-patch.ts`)

## Patching Strategy

Our approach uses several techniques:

1. **Module Conversion**: Converting CommonJS to ESM
2. **Dependency Management**: Using stable versions of libraries
3. **Monkey Patching**: Providing stub implementations
4. **Defensive Programming**: Adding null checks and fallbacks

### Key Patched Files

- `/src/utils/tabler-icons-wrapper.js`: Fixed ESM exports
- `/src/utils/trpc-monkey-patch.ts`: Added stub implementations
- `/src/contexts/IntegrationStatusContext.tsx`: Added resilient error handling

## Long-term Recommendations

For a more permanent solution:

1. **Complete ESM Migration**:
   - Update all files to use consistent ESM syntax
   - Remove any remaining CommonJS patterns

2. **Upgrade Strategy for next-auth**:
   - Wait for next-auth v5 to stabilize
   - Follow the official migration guide

3. **Proper tRPC Integration**:
   - Implement a proper tRPC client setup without monkey patches
   - Consider upgrading or downgrading to a compatible tRPC version

4. **Testing Strategy**:
   - Add comprehensive tests for the patched components
   - Ensure new components are tested with both real and mocked tRPC

## Additional Resources

- Dev Environment Fixes Documentation: Detailed explanation of fixes
- [next-auth Documentation](https://next-auth.js.org/): Official next-auth docs
- [tRPC Documentation](https://trpc.io/docs/): Official tRPC docs
- [ESM vs CommonJS](https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs): Node.js documentation