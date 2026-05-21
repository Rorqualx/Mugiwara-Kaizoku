# Task Status Migration Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Task Status Migration Plan

---
# Task Status Database Migration Plan

## Current Database State

In the current Prisma schema, the Task model has string fields for status and type:

```prisma
model Task {
  id                    Int       @id @default(autoincrement())
  type                  String                                    // Task type
  status                String    @default("PENDING")             // Task status
  // ... other fields
}
```

This approach lacks type safety at the database level and allows any string value to be stored in these fields, which can lead to inconsistencies.

## Target Database State

We want to define proper enums for TaskType and TaskStatus:

```prisma
enum TaskType {
  CHECK_CHAPTERS
  UPDATE_METADATA
  FIX_OUT_OF_SYNC
  NOTIFY
  BACKUP
  LIBRARY_SCAN
  METADATA_REFRESH
  CHAPTER_DOWNLOAD
  MANGA_IMPORT
  SYSTEM_MAINTENANCE
  SYNC_FIX
  CUSTOM
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
  PAUSED
  OUT_OF_SYNC
  SCHEDULED
}

model Task {
  id                    Int       @id @default(autoincrement())
  type                  TaskType                                  // Task type
  status                TaskStatus @default(PENDING)              // Task status
  // ... other fields
}
```

## Migration Considerations

1. **Data Validation**: 
   - Need to check all existing values to ensure they conform to the new enum
   - Convert any non-conforming values to appropriate enum values

2. **Code Updates**:
   - All Prisma queries must be updated to use the enum values
   - Need to use the compatibility layer during transition

3. **Compatibility Mode**:
   - Create database views to maintain backward compatibility
   - Update queries incrementally

## Migration Steps

### Phase 1: Analysis

1. Run database analysis to identify all distinct values in the type and status columns
2. Map existing values to the new enum values
3. Identify any problematic values that need special handling

### Phase 2: Create Enums and Migration

1. Create a database migration to:
   - Add the TaskType and TaskStatus enums
   - Create a temporary column for each enum field
   - Populate the temporary column with mapped values

### Phase 3: Switch Columns

1. Create a migration to:
   - Drop the original string columns
   - Rename the temporary columns to the original names
   - Add constraints and defaults

### Phase 4: Code Updates

1. Update Prisma schema to use the new enum types
2. Update all queries to use enum values instead of strings
3. Verify functionality with tests

## Fallback Plan

If issues are encountered during migration:

1. Keep the string columns but add validation at the application level
2. Create database triggers to enforce valid values
3. Implement a more gradual migration approach

## Timeline

- Phase 1: 1-2 days
- Phase 2: 1 day
- Phase 3: 1 day
- Phase 4: 2-3 days

## Testing Strategy

1. Create a staging database with production data
2. Run the migration on staging first
3. Verify all task creation, status transitions, and queries
4. Run comprehensive application tests against staging
5. Only migrate production after successful staging migration