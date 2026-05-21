# Enum Converter Pattern

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Enum Converter Pattern

---
# Enum Converter Pattern

This document describes the Enum Converter Pattern implemented in the Mugiwara-Kaizoku project for handling conversions between domain enums and database/Prisma enums.

## Problem Statement

The application uses different enum formats across its layers:

1. **Domain Enums**: Used in business logic and defined with lowercase values (e.g., `pending`, `completed`)
2. **Prisma/Database Enums**: Defined in the Prisma schema with uppercase values (e.g., `PENDING`, `COMPLETED`) 
3. **String Values**: Often received from external sources or legacy code

We need a type-safe way to convert between these formats while maintaining proper typing and preventing runtime errors.

## Solution: Enum Converter Pattern

The Enum Converter Pattern provides a standardized approach for converting between enum formats with the following components:

1. **Dedicated Converter Module**: A separate file for each enum type containing conversion functions
2. **Mapping Functions**: Functions that convert between domain and Prisma enum values
3. **Filter Generators**: Functions that create Prisma filters for queries
4. **Update Operation Generators**: Functions that create Prisma update operations
5. **String Converters**: Functions to handle string-to-enum conversions safely

## Implementation Examples

### Task Enum Converters

The task enum converters handle conversions between `TaskStatus`/`TaskType` domain enums and their Prisma counterparts:

```typescript
// From domain to Prisma
export function mapDomainStatusToPrisma(domainStatus: DomainTaskStatus): PrismaTaskStatus {
  switch (domainStatus) {
    case DomainTaskStatus.PENDING:
      return PrismaTaskStatus.PENDING;
    // Additional mappings...
    default:
      console.warn(`Unknown domain task status: ${domainStatus}, using PENDING as fallback`);
      return PrismaTaskStatus.PENDING;
  }
}

// From Prisma to domain
export function mapPrismaStatusToDomain(prismaStatus: PrismaTaskStatus): DomainTaskStatus {
  switch (prismaStatus) {
    case PrismaTaskStatus.PENDING:
      return DomainTaskStatus.PENDING;
    // Additional mappings...
    default:
      console.warn(`Unknown Prisma task status: ${prismaStatus}, using PENDING as fallback`);
      return DomainTaskStatus.PENDING;
  }
}
```

### Chapter Enum Converters

The chapter enum converters handle conversions between `ChapterStatus` domain enum and its Prisma counterpart:

```typescript
// From domain to Prisma
export function mapDomainStatusToPrisma(domainStatus: DomainChapterStatus): PrismaChapterStatus {
  switch (domainStatus) {
    case DomainChapterStatus.PENDING:
      return PrismaChapterStatus.PENDING;
    case DomainChapterStatus.DOWNLOADING:
      return PrismaChapterStatus.DOWNLOADING;
    case DomainChapterStatus.DOWNLOADED:
      return PrismaChapterStatus.COMPLETED; // Map DOWNLOADED to COMPLETED
    // Additional mappings...
    default:
      console.warn(`Unknown domain chapter status: ${domainStatus}, using PENDING as fallback`);
      return PrismaChapterStatus.PENDING;
  }
}
```

## Filter and Update Operation Generators

Both converter modules also provide utility functions for generating Prisma filters and update operations:

```typescript
// Create a filter for use in Prisma queries
export function createStatusFilter<T extends string = string>(
  domainStatus: DomainChapterStatus
): EnumChapterStatusFilter<T> {
  return {
    equals: mapDomainStatusToPrisma(domainStatus)
  };
}

// Create an update operation for use in Prisma updates
export function createStatusUpdateOperation(
  domainStatus: DomainChapterStatus
): EnumChapterStatusFieldUpdateOperationsInput {
  return {
    set: mapDomainStatusToPrisma(domainStatus)
  };
}
```

## Usage

### Direct Conversion

```typescript
import { mapChapterStatusToPrisma, mapPrismaStatusToChapterDomain } from '../utils/converters';

// Convert from domain to Prisma
const prismaStatus = mapChapterStatusToPrisma(ChapterStatus.DOWNLOADING);

// Convert from Prisma to domain
const domainStatus = mapPrismaStatusToChapterDomain(PrismaChapterStatus.DOWNLOADING);
```

### Within Database Operations

```typescript
import { createChapterStatusFilter, createChapterStatusUpdateOperation } from '../utils/converters';

// Create a Prisma query to find chapters with a specific status
const chapters = await prisma.chapter.findMany({
  where: {
    downloadStatus: createChapterStatusFilter(ChapterStatus.DOWNLOADING)
  }
});

// Update a chapter's status
await prisma.chapter.update({
  where: { id },
  data: {
    downloadStatus: createChapterStatusUpdateOperation(ChapterStatus.DOWNLOADED)
  }
});
```

### String Conversion

```typescript
import { stringToPrismaChapterStatus, mapPrismaStatusToChapterDomain } from '../utils/converters';

// Convert a string to a domain enum value
function convertStringToDomainStatus(statusString: string): ChapterStatus {
  // First convert to Prisma enum
  const prismaStatus = stringToPrismaChapterStatus(statusString);
  
  // Then convert to domain enum
  return mapPrismaStatusToChapterDomain(prismaStatus);
}
```

## Benefits

1. **Type Safety**: All conversions are fully typed and checked at compile time
2. **Centralized Logic**: Conversion logic is centralized in dedicated modules
3. **Consistent Fallbacks**: Standard fallback behavior for unknown values
4. **Proper Diagnostics**: Warnings when unknown values are encountered
5. **Standardized Pattern**: Same pattern can be applied to any enum type in the system
6. **Testability**: Conversion functions are pure and easily testable

## Adding New Enum Converters

To add a new enum converter:

1. Create a new file named `*-enum-converters.ts` in the `utils/converters` directory
2. Define the Prisma enum counterpart and necessary type definitions
3. Implement the conversion functions following the established pattern
4. Export the functions with appropriate naming in the `utils/converters/index.ts` file
5. Update documentation to reflect the new converter

This pattern ensures consistent handling of enum conversions throughout the application, reducing errors and improving maintainability.