# Task Enum Migration Guide

This document outlines the strategy for migrating the `TaskType` and `TaskStatus` enums from their legacy definitions to the standardized domain-driven type system.

## Background

The application previously used two different enum formats for task types and statuses:

1. Lowercase string literals in the legacy types/tasks.ts module:
   ```typescript
   enum TaskStatus {
     PENDING = 'pending',
     IN_PROGRESS = 'in_progress',
     // ...
   }
   ```

2. Uppercase string literals in some parts of the code and prisma-exports.ts:
   ```typescript
   enum TaskStatus {
     PENDING = 'PENDING',
     IN_PROGRESS = 'IN_PROGRESS',
     // ...
   }
   ```

Additionally, the `TaskType` enum had different values defined in different parts of the codebase.

## Migration Strategy

We're using a phased approach to migrate to the standardized domain types:

### Phase 1: Compatibility Layer (Current)

1. **Update Domain Enums**: We've updated the domain enums in `src/types/domain/task-types.ts` to include all values needed for compatibility:
   - Added missing `TaskType` values: CHECK_CHAPTERS, UPDATE_METADATA, etc.
   - Added both lowercase and uppercase `TaskStatus` values to ensure compatibility

2. **Create Compatibility Utilities**: We've created `src/utils/task-compatibility.ts` with:
   - Mapping functions between different enum formats
   - Helper functions for safe conversion
   - Type guards for validation

3. **Deprecate Legacy Module**: We've updated `src/types/tasks.ts` to:
   - Re-export from the domain types
   - Add deprecation warnings
   - Maintain backward compatibility

### Phase 2: Component Migration

For each component and module that uses `TaskType` or `TaskStatus`:

1. Update imports to use `@/types/domain/task-types` instead of legacy sources
2. Use the compatibility layer when interacting with APIs or stored data
3. Update any direct string comparisons to use enum values

### Phase 3: Database Layer Updates

1. Update Prisma schema and database models to use consistent values
2. Update query builders to use the standardized enum values
3. Ensure consistent handling of enum values in transactions

### Phase 4: Complete Migration

1. Remove legacy uppercase values from domain enums
2. Update compatibility layer to convert any remaining legacy values
3. Remove deprecated modules and utilities

## Guidelines for Developers

When working with tasks in the application:

1. **Always import from domain types**:
   ```typescript
   import { TaskStatus, TaskType } from '@/types/domain/task-types';
   ```

2. **Use the compatibility layer for conversion**:
   ```typescript
   import { toTaskStatus, toTaskType } from '@/utils/task-compatibility';
   
   // When receiving data from API or database
   const status = toTaskStatus(data.status);
   ```

3. **Prefer enum values over string literals**:
   ```typescript
   // Good
   if (task.status === TaskStatus.PENDING) { ... }
   
   // Avoid
   if (task.status === 'pending') { ... }
   ```

4. **When adding new task types or statuses**:
   - Add them to the domain enum in `src/types/domain/task-types.ts`
   - Update the compatibility layer in `src/utils/task-compatibility.ts`

## Files Requiring Updates

### Completed Files

The following files have been successfully migrated to use the domain types and compatibility layer:

1. ✅ `src/components/tasks/TaskList.tsx` - Updated to use domain types and compatibility layer for status rendering
2. ✅ `src/server/queue/index.ts` - Using compatibility layer for task type validation 
3. ✅ `src/server/queue/queueManager.ts` - Modified database queries to handle both uppercase and lowercase formats
4. ✅ `src/hooks/useDownloadQueue.ts` - Updated to use TaskStatus enum values
5. ✅ `src/server/trpc/routers/jobs.ts` - Using OR conditions to handle both formats in queries
6. ✅ `src/pages/jobs/active.tsx` - Updated to use domain TaskStatus
7. ✅ `src/server/queue/taskHandlers.ts` - Added support for both legacy and domain task types

### Remaining Files

All high-priority files have been migrated to use domain types. The following areas still need attention:

1. Event handling components that use task statuses
2. System event logs using task statuses
3. Any custom task visualizations or filters
4. Type definitions in Prisma schema

## Testing Strategy

For each migration:

1. Run TypeScript type-checking to ensure type compatibility
2. Test task creation, status transitions, and filtering in the UI
3. Verify that task queues continue to process tasks correctly
4. Ensure backward compatibility with existing stored tasks

## Rollback Plan

If issues are encountered:

1. Revert domain enum changes
2. Restore original module exports
3. Remove compatibility layer
4. Update any modified imports

## Implementation Progress

### Phase 1: Compatibility Layer ✅

- Created domain enums in `src/types/domain/task-types.ts`
- Added compatibility values to handle both formats
- Implemented `src/utils/task-compatibility.ts` with mapping functions
- Added unit tests for the compatibility layer
- Updated the legacy module to re-export from domain types

### Phase 2: Component Migration ✅

- Updated UI components to use domain types (TaskList.tsx, etc.)
- Modified hooks to use the new enum values (useDownloadQueue.ts)
- Updated all task pages to use domain TaskStatus:
  - active.tsx
  - completed.tsx
  - failed.tsx
  - queued.tsx
  - scheduled.tsx
  - out-of-sync.tsx
- Added compatibility to queue management systems
- Updated test files to use domain types

### Phase 3: Database Layer 🔄

- Modified database queries to handle both uppercase and lowercase formats
- Updated validation functions to use the compatibility layer
- Added OR conditions to queries to support both formats
- 50% complete - need to standardize all database operations

### Phase 4: Complete Migration ⏳

- Not yet started
- Will involve removing legacy uppercase values
- Will standardize on lowercase values throughout the codebase
- Will clean up compatibility layer once standardization is complete