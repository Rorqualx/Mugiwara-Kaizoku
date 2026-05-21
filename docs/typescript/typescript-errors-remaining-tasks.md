# Typescript Errors Remaining Tasks

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Errors Remaining Tasks

---
# TypeScript Errors: Remaining Tasks

## Overview

This document outlines the remaining TypeScript errors in the codebase and provides a plan for addressing them. While the primary objectives of Phase 4 have been achieved with the implementation of enhanced error handling patterns, there are still TypeScript errors that need to be resolved.

## Current Progress

The following key tasks have been completed:

1. Implemented enhanced error handling patterns in adapter implementations
2. Created comprehensive documentation for error handling patterns
3. Removed duplicate standardized files
4. Created a task store with proper TypeScript typing
5. Fixed several TypeScript errors:
   - Icon component interface issues
   - Boolean call signature errors
   - ID type conversion issues
   - CSS module property access issues
   - Task state duplication issues

## Remaining TypeScript Errors

The remaining TypeScript errors can be categorized as follows:

### 1. Icon Component References

Many components reference icon components that are not exported from the tabler-icons-wrapper:

```typescript
// Example error:
src/components/events/EventDetailsModal.tsx(81,17): error TS2304: Cannot find name 'IconAlertCircle'.
```

**Solution Approach:**
- Add all missing icon exports to the tabler-icons-wrapper.ts file
- Update components to use the available icons or similar alternatives

### 2. Store Selector Access

Components are trying to access properties on the store selectors that don't exist:

```typescript
// Example error:
src/components/addManga/steps/confirmationStep.tsx(227,43): error TS2339: Property 'manga' does not exist on type '{ tasks: {...} }'.
```

**Solution Approach:**
- Enhance the mock implementation in useTaskSelectors to provide all required properties
- Update component imports to use the correct store selector paths

### 3. Component Prop Type Mismatches

Some components have prop type mismatches:

```typescript
// Example error:
src/components/addManga/form.tsx(475,17): error TS2322: Type '{ ... }' is not assignable to type 'IntrinsicAttributes & ConfirmationStepProps'.
```

**Solution Approach:**
- Update component prop interfaces to match the expected types
- Fix component implementations to provide the correct props

### 4. Implicit 'any' Types

There are several instances of implicit 'any' types that need explicit typing:

```typescript
// Example error:
src/components/addManga/steps/confirmationStep.tsx(361,55): error TS7006: Parameter 'result' implicitly has an 'any' type.
```

**Solution Approach:**
- Add explicit type annotations to all parameters
- Use appropriate interfaces or type aliases for complex types

### 5. TRPC Client Configuration

The TRPC client configuration has type compatibility issues:

```typescript
// Example error:
src/utils/trpc-client/direct-export.ts(31,3): error TS2322: Type '() => { ... }' is not assignable to type '(info: { ctx?: NextPageContext | undefined; }) => WithTRPCConfig<...>'.
```

**Solution Approach:**
- Update the TRPC client configuration to match the expected interface
- Consider upgrading or downgrading the TRPC dependency to resolve compatibility issues

## Prioritized Implementation Plan

### High Priority (Required for Phase 4)

1. **Fix Store Selector Access Issues**
   - Complete the implementation of useTaskSelectors to provide all required properties
   - Update RootStoreProvider to use the task selectors

2. **Fix Icon Component References**
   - Add all missing icon exports to tabler-icons-wrapper.ts
   - Update components to use available icons

### Medium Priority (Phase 5)

3. **Fix Component Prop Type Mismatches**
   - Update component interfaces to match expected types
   - Fix component implementations

4. **Fix Implicit 'any' Types**
   - Add explicit type annotations to all parameters
   - Create appropriate interfaces or type aliases

### Low Priority (Future Work)

5. **TRPC Client Configuration**
   - Research and implement a proper fix for TRPC client type compatibility
   - Consider dependency updates if necessary

## Implementation Guidelines

When addressing the remaining TypeScript errors, follow these guidelines:

1. **Focused Fixes**
   - Focus on fixing one category of errors at a time
   - Begin with store selector access issues as they affect the most components

2. **Minimal Changes**
   - Make minimal changes required to fix the TypeScript errors
   - Avoid large refactorings that might introduce new errors

3. **Test After Each Change**
   - Run TypeScript verification after each significant change
   - Fix any new errors introduced by your changes

4. **Document Patterns**
   - Document the patterns used to fix each category of errors
   - Create reusable solutions for similar errors

## Conclusion

While there are still TypeScript errors to resolve, the primary objectives of Phase 4 have been achieved with the implementation of enhanced error handling patterns. The approach outlined in this document provides a clear path forward for resolving the remaining TypeScript errors in a systematic way.

The priority should be on fixing the store selector access issues and icon component references, as these affect the most components and have straightforward solutions. The remaining issues can be addressed in Phase 5 or as future work.