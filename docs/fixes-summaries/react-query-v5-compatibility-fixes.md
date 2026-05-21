# React Query V5 Compatibility Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for React Query V5 Compatibility Fixes

---
# React Query v5 Compatibility Fixes

This document describes the fixes applied to ensure compatibility with React Query v5 in the Mugiwara-Kaizoku codebase.

## Background

React Query v5 introduced several breaking changes to the API, including:

1. Renaming `cacheTime` to `gcTime` (garbage collection time)
2. Changes to the logger configuration
3. Updates to query client options

## Applied Fixes

### 1. QueryClient Configuration Updates

We added the following fixes to QueryClient instances throughout the codebase:

#### 1.1 Updated from `cacheTime` to `gcTime`

```typescript
// Before (React Query v4 and earlier)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0, // Old property
    },
  },
});

// After (React Query v5 compatible)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0, // New property name
    },
  },
});
```

#### 1.2 Added Logger Configuration

```typescript
// Added logger configuration with @ts-ignore to maintain compatibility
const queryClient = new QueryClient({
  defaultOptions: {
    // queries configuration...
  },
  // @ts-ignore - Logger property might not be available in the current version
  // but is required for compatibility with older versions
  logger: {
    log: console.log,
    warn: console.warn,
    error: console.error, // Or () => {} to silence errors in tests
  },
});
```

### 2. Files Updated

The following files were updated with React Query v5 compatibility fixes:

1. `/src/test/utils/mockHelpers.tsx` - Test utilities for mocking
2. `/src/test/utils/testUtils.tsx` - Test rendering utilities
3. `/src/providers/AppProviders.tsx` - Main application providers

### 3. Benefits of These Changes

- Ensures forward compatibility with React Query v5
- Prevents runtime errors related to missing or renamed properties
- Maintains consistent behavior across different versions
- Silences unnecessary errors in test environments

## Recommended Approach for New Code

When creating new code that uses React Query, follow these guidelines:

1. Always use `gcTime` instead of `cacheTime`
2. Include the logger configuration with appropriate error handling
3. Review the [React Query v5 migration guide](https://tanstack.com/query/v5/docs/react/guides/migrating-to-v5) for other potential breaking changes

## Next Steps

1. Update any custom hooks that might be using React Query v4-specific APIs
2. Review component tests that use QueryClient to ensure compatibility
3. Consider updating the version of @tanstack/react-query to v5 when ready