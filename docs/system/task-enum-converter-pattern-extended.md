# Task Enum Converter Pattern Extended

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Task Enum Converter Pattern Extended

---
# Task Enum Converter Pattern (Extended)

This document explains the extended Task Enum Converter pattern implemented in the Mugiwara-Kaizoku codebase to ensure proper type safety when working with TaskStatus and TaskType enums between domain and Prisma database layers.

## Problem Statement

We have two different representations of the same concepts (TaskStatus and TaskType):

1. **Domain Enums**: In `types/domain/task-types.ts`, defined with lowercase values:
   ```typescript
   export enum TaskStatus {
     PENDING = 'pending',
     QUEUED = 'queued',
     // etc.
   }
   ```

2. **Prisma Enums**: In the database schema, defined with uppercase values:
   ```typescript
   export enum TaskStatus {
     PENDING = 'PENDING',
     QUEUED = 'QUEUED',
     // etc.
   }
   ```

This discrepancy causes TypeScript errors when trying to use domain enums in Prisma queries, because:
- The string values don't match (case difference)
- Prisma expects its own enum types for filters and update operations

## Solution

The extended Task Enum Converter pattern provides a comprehensive solution with:

1. **Type-Safe Enum Definitions**: Explicit definition of both domain and Prisma enums with proper types
2. **Bidirectional Mapping Functions**: Convert between domain and Prisma enum formats
3. **String Conversion Utilities**: Handle legacy string inputs for backward compatibility
4. **Prisma Filter Factories**: Generate type-safe Prisma filters for queries
5. **Update Operation Factories**: Generate type-safe update operations for database writes

## Implementation

### 1. Explicit Prisma Enum Definitions

Created `src/types/prisma-task-enums.ts` with proper Prisma-style enums:

```typescript
export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  // etc.
}

export type EnumTaskStatusFilter<T extends string = string> = {
  equals?: TaskStatus;
  in?: TaskStatus[];
  // etc.
};
```

### 2. Conversion Functions

Enhanced `src/utils/converters/task-enum-converters.ts` with comprehensive functions:

```typescript
// Domain to Prisma conversion
export function mapDomainStatusToPrisma(domainStatus: DomainTaskStatus): PrismaTaskStatus {
  switch (domainStatus) {
    case DomainTaskStatus.PENDING:
      return PrismaTaskStatus.PENDING;
    // etc.
  }
}

// Prisma to Domain conversion
export function mapPrismaStatusToDomain(prismaStatus: PrismaTaskStatus): DomainTaskStatus {
  switch (prismaStatus) {
    case PrismaTaskStatus.PENDING:
      return DomainTaskStatus.PENDING;
    // etc.
  }
}

// String to Prisma conversion (for backward compatibility)
export function stringToPrismaStatus(statusString: string): PrismaTaskStatus {
  const upperStatus = statusString.toUpperCase();
  // Logic to handle various string formats
}
```

### 3. Filter and Update Operation Factories

Added helper functions to create Prisma query filters and update operations:

```typescript
// Create a Prisma filter for status
export function createStatusFilter<T extends string = string>(
  domainStatus: DomainTaskStatus
): EnumTaskStatusFilter<T> {
  return {
    equals: mapDomainStatusToPrisma(domainStatus)
  };
}

// Create a Prisma update operation for status
export function createStatusUpdateOperation(
  domainStatus: DomainTaskStatus
): EnumTaskStatusFieldUpdateOperationsInput {
  return {
    set: mapDomainStatusToPrisma(domainStatus)
  };
}
```

## Usage Examples

### 1. In Server-Side Prisma Queries

```typescript
import { TaskStatus } from '../../types/domain/task-types';
import { createStatusFilter, createStatusUpdateOperation } from '../../utils/converters/task-enum-converters';

// Query tasks with a specific status
const pendingTasks = await prisma.task.findMany({
  where: {
    status: createStatusFilter(TaskStatus.PENDING)
  }
});

// Update a task's status
await prisma.task.update({
  where: { id },
  data: {
    status: createStatusUpdateOperation(TaskStatus.COMPLETED)
  }
});
```

### 2. Converting API Input to Prisma Format

```typescript
import { stringToPrismaStatus } from '../../utils/converters/task-enum-converters';

// Handle API input with unknown format
function handleStatusFilter(statusString: string) {
  return {
    status: {
      equals: stringToPrismaStatus(statusString)
    }
  };
}
```

### 3. Converting Database Results to Domain Format

```typescript
import { mapPrismaStatusToDomain } from '../../utils/converters/task-enum-converters';

// Transform database results to domain objects
function mapTasksToDomain(prismaTasks) {
  return prismaTasks.map(task => ({
    ...task,
    status: mapPrismaStatusToDomain(task.status)
  }));
}
```

## Benefits

1. **Type Safety**: Eliminates TypeScript errors related to enum compatibility
2. **Error Reduction**: Prevents runtime errors from using incorrect enum formats
3. **Centralized Conversion**: Single source of truth for conversion logic
4. **Graceful Fallbacks**: Handles unknown values with sensible defaults
5. **Clear Separation**: Maintains separation between domain and database layers
6. **Improved Developer Experience**: Simplifies working with enums across layers
7. **Future Compatibility**: Easier to adapt to changes in either layer

## Next Steps

1. Apply this pattern to other enum types in the system
2. Create integration tests for the conversion functions
3. Add logging and monitoring for unknown enum values
4. Document usage in developer guides