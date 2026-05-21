# Status Mapping Standardization

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Status Mapping Standardization

---
# MangaStatus Standardization

## Overview

This document details the standardization of the MangaStatus enum and related mapping functions across the Mugiwara-Kaizoku project. This work is part of the TypeScript error resolution process, addressing inconsistencies in status handling that caused type errors.

## Problem Statement

The project had multiple MangaStatus enum definitions across different modules:

1. `src/types/domain/manga-types.ts` - Primary domain MangaStatus
2. `src/utils/converters/TypeGuards.ts` - Local definition to avoid import issues
3. `src/api/base/MetadataProvider.ts` - API-specific MangaStatus
4. `src/types/clientTypes.ts` - Client-specific MangaStatus with different values
5. `src/types/prisma-exports.ts` - Database-specific MangaStatus

These inconsistencies caused type errors when values were passed between modules, particularly in adapters and components that interacted with multiple layers of the application.

## Solution

The solution involves:

1. Establishing the `src/types/domain/manga-types.ts` MangaStatus as the canonical enum
2. Enhancing the existing `src/utils/status-mapping.ts` with comprehensive mapping functions
3. Providing type-safe conversion between all variants of MangaStatus

### Key Improvements

#### 1. Enhanced Generic Mapping Function

Added a robust `mapToDomainStatus` function that can handle any string-based status format and convert it to the domain MangaStatus:

```typescript
export function mapToDomainStatus(providerStatus: unknown): DomainMangaStatus {
  if (!providerStatus) {
    return DomainMangaStatus.UNKNOWN;
  }
  
  const status = String(providerStatus).toLowerCase();
  
  // Ongoing/Publishing/Releasing
  if (
    status.includes('ongoing') || 
    status.includes('publishing') || 
    status.includes('releasing') ||
    status.includes('current') ||
    status.includes('active')
  ) {
    return DomainMangaStatus.ONGOING;
  }
  
  // Completed/Finished
  if (
    status.includes('completed') || 
    status.includes('finished') ||
    status.includes('ended')
  ) {
    return DomainMangaStatus.COMPLETED;
  }
  
  // ...other status checks...
  
  return DomainMangaStatus.UNKNOWN;
}
```

#### 2. Provider-Specific Mapping Functions

Added mapping functions for specific providers:

- `mapAniListStatusToDomain`
- `mapMangaDexStatusToDomain`
- `mapComicVineStatusToDomain`
- `mapFandomStatusToDomain`

These functions handle the provider-specific status strings and convert them to the domain MangaStatus.

#### 3. Utility Functions

Added utility functions to work with MangaStatus:

- `getAllMangaStatuses` - Returns all valid MangaStatus enum values
- `getMangaStatusLabel` - Converts MangaStatus to a human-readable string
- `isValidMangaStatus` - Type guard to check if a value is a valid MangaStatus

#### 4. Improved Existing Mapping Functions

Enhanced the existing mapping functions with JSDoc comments and made them more robust:

- `mapPrismaToDomainStatus` and `mapDomainToPrismaStatus`
- `mapCommonToDomainStatus` and `mapDomainToCommonStatus`
- `mapApiToDomainStatus` and `mapDomainToApiStatus`

### Benefits

1. **Type Safety**: Consistent handling of status values ensures type safety across the application
2. **Centralized Logic**: All status mapping is now handled in a single module
3. **Comprehensive Coverage**: All provider status formats are now supported
4. **Documentation**: JSDoc comments provide clear documentation for all functions
5. **Maintainability**: Easy to update and extend for new providers or status values

## Implementation

The enhanced status mapping is implemented in `src/utils/status-mapping.ts`, which now serves as the central location for all status-related functionality.

## Usage

```typescript
import { MangaStatus } from '../types/domain/manga-types';
import { 
  mapToDomainStatus,
  mapAniListStatusToDomain,
  isValidMangaStatus,
  getMangaStatusLabel
} from '../utils/status-mapping';

// Generic mapping
const status = mapToDomainStatus('publishing'); // Returns MangaStatus.ONGOING

// Provider-specific mapping
const anilistStatus = mapAniListStatusToDomain('RELEASING'); // Returns MangaStatus.ONGOING

// Type guard
if (isValidMangaStatus(someValue)) {
  // someValue is now typed as MangaStatus
  console.log(getMangaStatusLabel(someValue));
}
```

## Adapter Implementation

To fix adapter-related type errors, adapters should use these mapping functions:

```typescript
import { mapAniListStatusToDomain } from '../utils/status-mapping';

// Inside AniListAdapter
protected mapStatus(providerStatus: unknown): MangaStatus {
  return mapAniListStatusToDomain(String(providerStatus));
}
```

## Next Steps

1. Update all adapters to use the appropriate mapping functions
2. Fix remaining type errors in components that use MangaStatus
3. Consider creating a similar standardization for other enums (e.g., ChapterStatus)