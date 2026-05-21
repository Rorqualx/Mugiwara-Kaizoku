# Manga Status Standardization Updated

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Manga Status Standardization Updated

---
# MangaStatus Standardization Update

> ⚠️ **CANONICAL DOCUMENTATION**: This is the updated guide for MangaStatus usage. 
> 
> **Last Updated**: June 2025  
> **Status**: Active Standard

## Overview

The MangaStatus enum has been further standardized to resolve import conflicts and improve the mapping between different status representations. This update builds on the previous standardization while addressing new issues found in the codebase.

## Key Updates

1. **ClientMangaStatus Creation**: Created a separate `ClientMangaStatus` enum for UI operational status
2. **Standardized Mapping Function Names**: All mapping functions now follow a consistent naming pattern
3. **Fixed Path Aliases**: Replaced all `@/` style imports with relative imports
4. **Backward Compatibility Aliases**: Added backward compatibility for existing code

## Canonical Definitions

### Domain MangaStatus (Publication Status)

The canonical MangaStatus enum is defined in `src/types/domain/manga-types.ts`:

```typescript
export enum MangaStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  HIATUS = 'hiatus',
  UNKNOWN = 'unknown'
}
```

### Client MangaStatus (Operational Status)

The UI operational status enum is defined in `src/types/clientTypes.ts`:

```typescript
export enum ClientMangaStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  DELETED = 'DELETED'
}
```

## Updated Status Mapping

All mapping functions are now in `src/utils/status-mapping.ts` with consistent naming:

### Provider to Domain Mapping

```typescript
// Generic mapping function (unchanged)
import { mapToDomainStatus } from '../utils/status-mapping';
const domainStatus = mapToDomainStatus(providerStatus);

// Provider-specific functions (NEW NAMES)
import { 
  mapAniListStatusToDomain,
  mapMangaDexStatusToDomain,
  mapComicVineStatusToDomain,
  mapFandomStatusToDomain
} from '../utils/status-mapping';

// Examples
const anilistStatus = mapAniListStatusToDomain(anilistStatus);
const mangadexStatus = mapMangaDexStatusToDomain(mangadexStatus);
const comicvineStatus = mapComicVineStatusToDomain(comicvineStatus);
const fandomStatus = mapFandomStatusToDomain(fandomStatus);
```

### Domain to Provider/Client Mapping (NEW)

```typescript
import { 
  mapDomainToAniListStatus,
  mapDomainToClientStatus,
  mapDomainToPrismaStatus
} from '../utils/status-mapping';

// Convert domain status to provider-specific format
const anilistStatus = mapDomainToAniListStatus(domainStatus);

// Convert domain status to client operational status
const clientStatus = mapDomainToClientStatus(domainStatus);

// Convert domain status to database status
const dbStatus = mapDomainToPrismaStatus(domainStatus);
```

### Backward Compatibility

The old function names are still supported as aliases (but deprecated):

```typescript
// Old names (DEPRECATED) - these still work but show deprecation warnings
import { 
  anilistToDomainStatus,
  mangadexToDomainStatus,
  comicvineToDomainStatus,
  fandomToDomainStatus
} from '../utils/status-mapping';
```

## Best Practices for New Code

1. **Always use the new naming pattern**:
   ```typescript
   // PREFERRED
   import { mapAniListStatusToDomain } from '../utils/status-mapping';
   ```

2. **Use relative imports**:
   ```typescript
   // PREFERRED
   import { MangaStatus } from '../types/domain/manga-types';
   
   // AVOID
   import { MangaStatus } from '@/types/domain/manga-types';
   ```

3. **Be explicit about which status you're using**:
   ```typescript
   // PREFERRED - Clear which status type you're using
   import { MangaStatus } from '../types/domain/manga-types';
   import { ClientMangaStatus } from '../types/clientTypes';
   ```

4. **Convert between status types using the right mapping functions**:
   ```typescript
   // PREFERRED
   import { mapDomainToClientStatus } from '../utils/status-mapping';
   
   // Convert domain publication status to client operational status
   const clientStatus = mapDomainToClientStatus(manga.status);
   ```

## Files Modified in This Update

1. `/src/types/clientTypes.ts`
   - Added `ClientMangaStatus` enum
   - Updated imports to use relative paths

2. `/src/types/domain/index.ts`
   - Updated namespace exports

3. `/src/utils/status-mapping.ts`
   - Added new mapping functions with consistent naming
   - Created aliases for backward compatibility

4. Adapter files:
   - Updated to use the new mapping function names
   - Fixed relative imports

## Migration Guide

If you're working with existing code:

1. **Update imports**:
   ```typescript
   // Before
   import { anilistToDomainStatus } from '../utils/mapping/status-mapping';
   
   // After
   import { mapAniListStatusToDomain } from '../utils/status-mapping';
   ```

2. **Update function calls**:
   ```typescript
   // Before
   const status = anilistToDomainStatus(anilistStatus);
   
   // After
   const status = mapAniListStatusToDomain(anilistStatus);
   ```

3. **Be explicit about client vs. domain status**:
   ```typescript
   // Before
   import { MangaStatus } from '@/types/domain/manga-types';
   
   // After
   import { MangaStatus } from '../types/domain/manga-types';
   import { ClientMangaStatus } from '../types/clientTypes';
   ```

## Related Documentation

- `src/types/domain/manga-types.ts` - Canonical domain status enum
- `src/types/clientTypes.ts` - Client operational status enum
- `src/utils/status-mapping.ts` - All mapping functions
- `docs/manga-status-standardization-final.md` - Comprehensive explanation

---

**Remember**: The goal is consistent, type-safe status handling throughout the codebase.