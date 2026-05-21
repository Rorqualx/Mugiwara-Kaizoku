# Manga Status Standardization

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Manga Status Standardization

---
# MangaStatus Standardization Guide

## Overview

This document provides guidance on standardizing the use of the `MangaStatus` enum across the codebase. We have identified multiple incompatible definitions of `MangaStatus` that are causing TypeScript errors and inconsistent behavior.

## Current Status Enums

We have identified the following `MangaStatus` definitions in the codebase:

### 1. Domain Model MangaStatus (Canonical Version)
Located in: `src/types/domain/manga-types.ts`

```typescript
export enum MangaStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  HIATUS = 'hiatus',
  UNKNOWN = 'unknown'
}
```

This is the canonical version that should be used throughout the application domain logic.

### 2. Prisma Schema MangaStatus
Located in: `prisma/schema.prisma`

```prisma
enum MangaStatus {
  PENDING
  ACTIVE
  COMPLETED
  ERROR
  DELETED
}
```

This represents the application status in the database, which is different from the publication status.

### 3. Prisma Exports MangaStatus
Located in: `src/types/prisma-exports.ts`

```typescript
export enum MangaStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  HIATUS = 'HIATUS',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN'
}
```

This is a re-export of the domain model status but with uppercase values.

### 4. API MangaStatus
Located in: `src/api/base/MetadataProvider.ts`

```typescript
export enum MangaStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  HIATUS = 'hiatus',
  CANCELLED = 'cancelled',
  UNKNOWN = 'unknown'
}
```

This matches the domain model but is separately defined.

### 5. Common MangaStatus
Located in: `src/types/common.ts`

```typescript
export type MangaStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ERROR' | 'DELETED';
```

This is a string literal type that matches the Prisma schema values.

## Standardization Approach

To resolve the conflicts and standardize the usage of MangaStatus across the codebase, we've implemented the following approach:

1. **Use Domain Model as the Source of Truth**: The enum defined in `src/types/domain/manga-types.ts` should be the canonical version used throughout the domain logic.

2. **Explicit Type Mapping**: Use the mapping functions in `src/utils/status-mapping.ts` to convert between different status representations instead of using type assertions (`as MangaStatus`).

3. **Documentation**: Document the different status enums and their usage in code comments.

## Mapping Functions

The `src/utils/status-mapping.ts` file provides the following mapping functions:

- `mapPrismaToDomainStatus`: Maps Prisma schema status to domain model status
- `mapDomainToPrismaStatus`: Maps domain model status to Prisma schema status
- `mapCommonToDomainStatus`: Maps common string status to domain model status
- `mapDomainToCommonStatus`: Maps domain model status to common string status
- `mapApiToDomainStatus`: Maps API status to domain model status
- `mapDomainToApiStatus`: Maps domain model status to API status
- `stringToDomainStatus`: Maps any string status to domain model status

## Example Usage

Instead of using type assertions (`as MangaStatus`), use the appropriate mapping function:

```typescript
// Before
const status = (data.status || MangaStatus.UNKNOWN) as MangaStatus;

// After
import { stringToDomainStatus } from '@/utils/status-mapping';
const status = data.status ? stringToDomainStatus(data.status) : MangaStatus.UNKNOWN;
```

## Files to Update

The following files contain unsafe type assertions and should be updated:

1. `src/utils/dataFetching.ts`
2. `src/api/metadataProviders/adapters/anilistAdapter.standardized.ts`
3. `src/api/metadataProviders/adapters/mangadexAdapter.standardized.ts`
4. `src/server/trpc/routers/metadata.standardized.ts`
5. `src/services/manga.service.ts`

## Additional Considerations

1. **Naming Consistency**: Consider adding the word "Publication" or "Application" to distinguish between the two primary types of status (e.g., `PublicationStatus` vs `ApplicationStatus`).

2. **Client-Server Boundary**: Ensure proper type conversion happens at the boundary between client and server.

3. **Database Layer**: Consider updating the Prisma schema to align the database representation with the domain model if possible.

## Next Steps

1. Complete the migration of all `as MangaStatus` type assertions to proper mapping functions.
2. Add validation at API boundaries to ensure consistent status values.
3. Update documentation and add tests for status mapping functions.
4. Identify and fix related enums that might have similar issues (e.g., `ChapterStatus`, `TaskStatus`).