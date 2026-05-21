# Use Task Counts Consolidation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Use Task Counts Consolidation

---
# useTaskCounts Hook Consolidation

## Overview

This document outlines the consolidation of the `useTaskCounts` hook implementations, merging the improvements from `useTaskCounts.fixed.ts` into the canonical `useTaskCounts.ts` file.

## Files Involved

1. **Canonical file**: `/src/hooks/useTaskCounts.ts`
2. **Fixed file**: `/src/hooks/useTaskCounts.fixed.ts`

## Key Improvements to Merge

1. **AsyncResult Pattern Implementation**
   - Add AsyncResult type for better state handling
   - Implement proper loading, success, and error states
   - Add type guards with `isSuccess` and `isError`

2. **Enhanced Type Safety**
   - Improve type inference from TRPC router
   - Remove type assertion in favor of proper state handling
   - Add proper error handling with instance checks

3. **Default Values**
   - Add default empty task counts for fallback
   - Provide a simplified hook for accessing task counts with defaults

4. **Import Path Fixes**
   - Fix relative import paths according to project standards
   - Ensure consistent import organization

## Implementation Strategy

1. Update imports to include AsyncResult utilities
2. Add default task counts for fallback values
3. Implement the main hook with AsyncResult pattern
4. Add the simplified hook for direct access with defaults
5. Update documentation to reflect the changes

## Backward Compatibility

The implementation will maintain backward compatibility by:
1. Ensuring the main hook returns a properly typed AsyncResult
2. Adding a secondary hook that provides the same interface as the original hook
3. Preserving the TaskCounts interface

## Consolidated Implementation

The consolidated implementation will:
1. Use AsyncResult pattern for proper state handling
2. Provide detailed typing for all states
3. Add proper error handling for network failures
4. Include a simplified hook for components that don't need the full AsyncResult

This consolidation will make the hook more robust, type-safe, and easier to use in different contexts while maintaining backward compatibility with existing code.