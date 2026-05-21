# Task Enum Converter Pattern

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Task Enum Converter Pattern

---
# Task Enum Converter Pattern

## Overview

This document describes the Task Enum Converter pattern implemented to resolve type compatibility issues between domain task enums and Prisma database enums.

## Problem

Our codebase has multiple representations of task status and type enums:

1. **Domain Enums** (in `src/types/domain/task-types.ts`):
   - Use string values (e.g., `'pending'`, `'completed'`)
   - Include newer standardized statuses like `'queued'`
   - Provide the primary interface for application code

2. **Prisma Enums** (in `prisma/schema.prisma`):
   - Use uppercase identifiers (e.g., `PENDING`, `COMPLETED`)
   - Do not include all domain enum values
   - Define the database schema constraints

3. **Legacy Type Definitions** (in `src/types/prismaTypes.ts`):
   - Use uppercase string values (e.g., `'PENDING'`, `'COMPLETED'`)
   - Transitional types being phased out

These inconsistencies cause TypeScript errors when attempting to use domain enum values directly with Prisma operations, as the string values don't match.

## Solution

We've implemented a converter pattern that provides utility functions to safely map between the different enum representations:

### 1. Conversion Utility Module

The `src/utils/converters/task-enum-converters.ts` module provides four main functions:

- `mapDomainStatusToPrisma(domainStatus)`: Converts domain TaskStatus to Prisma format
- `mapPrismaStatusToDomain(prismaStatus)`: Converts Prisma TaskStatus to domain format
- `mapDomainTypeToPrisma(domainType)`: Converts domain TaskType to Prisma format
- `mapPrismaTypeToDomain(prismaType)`: Converts Prisma TaskType to domain format

### 2. Usage Pattern

When working with Prisma operations that involve task enums:

```typescript
// Import domain types with aliases to avoid confusion
import { TaskStatus as DomainTaskStatus } from '../../types/domain/task-types';
import { mapDomainStatusToPrisma } from '../../utils/converters/task-enum-converters';

// When using in Prisma operations
await prisma.task.update({
  where: { id: taskId },
  data: {
    status: mapDomainStatusToPrisma(DomainTaskStatus.COMPLETED),
    updatedAt: new Date()
  }
});
```

When receiving task data from Prisma and converting to domain models:

```typescript
import { mapPrismaStatusToDomain } from '../../utils/converters/task-enum-converters';

function convertPrismaTaskToDomain(prismaTask) {
  return {
    id: prismaTask.id,
    status: mapPrismaStatusToDomain(prismaTask.status),
    // ... other properties
  };
}
```

### 3. Handling Missing Enums

The converter functions handle cases where domain enums don't exist in Prisma:

- The `'queued'` status (which doesn't exist in Prisma) is mapped to `'PENDING'` in the database
- Unknown statuses are mapped to reasonable defaults with warning logs
- Type-safety is maintained throughout the conversion process

## Benefits

1. **Type Safety**: Enforces correct enum usage with proper TypeScript types
2. **Compatibility**: Allows domain code to use standardized enums while maintaining database compatibility
3. **Centralization**: Keeps conversion logic in one place for easier updates
4. **Error Prevention**: Catches mismatches at compile time rather than runtime
5. **Graceful Degradation**: Provides reasonable fallbacks for unmapped values

## Files Fixed

The following files were updated to use the enum converter pattern:

1. `src/server/queue/notify.ts`: Fixed task status updates in DB operations
2. `src/server/trpc/router/appRouter.ts`: Adjusted query filters for task statuses
3. *[Additional files to be documented as they are fixed]*

## Future Improvements

1. **Database Schema Updates**: Consider updating the Prisma schema to include missing enum values
2. **Integration Tests**: Add tests to verify correct enum mapping
3. **Gradual Migration**: Continue replacing direct enum string usage with converter functions
4. **Metrics Collection**: Add telemetry to identify any remaining conversion issues

## Implementation Example

```typescript
/**
 * Maps a domain TaskStatus to the equivalent Prisma TaskStatus
 * @param domainStatus Domain TaskStatus value
 * @returns The equivalent Prisma TaskStatus value
 */
export function mapDomainStatusToPrisma(domainStatus: DomainTaskStatus): string {
  switch (domainStatus) {
    // Handle the standardized lowercase values
    case DomainTaskStatus.PENDING:
      return 'PENDING';
    case DomainTaskStatus.QUEUED:
      return 'PENDING'; // Map to closest equivalent
    case DomainTaskStatus.RUNNING:
      return 'RUNNING';
    case DomainTaskStatus.COMPLETED:
      return 'COMPLETED';
    case DomainTaskStatus.FAILED:
      return 'FAILED';
    case DomainTaskStatus.CANCELLED:
      return 'CANCELLED';
    case DomainTaskStatus.PAUSED:
      return 'PAUSED';
    
    // Legacy uppercase values are already compatible
    case DomainTaskStatus.IN_PROGRESS:
      return 'IN_PROGRESS';
    case DomainTaskStatus.OUT_OF_SYNC:
      return 'OUT_OF_SYNC';
    case DomainTaskStatus.SCHEDULED:
      return 'SCHEDULED';
    
    default:
      // Handle unknown values - convert to PENDING as fallback
      console.warn(`Unknown domain task status: ${domainStatus}, using PENDING as fallback`);
      return 'PENDING';
  }
}
```