# Manga Status Standardization Final

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Manga Status Standardization Final

---
# MangaStatus Standardization Guide

> ⚠️ **CANONICAL DOCUMENTATION**: This is the authoritative guide for MangaStatus usage. All other MangaStatus documentation is deprecated.
> 
> **Last Updated**: January 2025  
> **Status**: Active Standard

## Overview

The MangaStatus enum has been standardized to resolve conflicts between 5+ different definitions found across the codebase. This guide provides the canonical definition and usage patterns.

## Canonical Definition

The **ONLY** valid MangaStatus enum is defined in `src/types/domain/manga-types.ts`:

```typescript
export enum MangaStatus {
  UNKNOWN = 'UNKNOWN',
  ONGOING = 'ONGOING', 
  COMPLETED = 'COMPLETED',
  HIATUS = 'HIATUS',
  CANCELLED = 'CANCELLED'
}
```

**Key Points**:
- Values are UPPERCASE strings
- This is a **domain** enum (not database)
- All provider statuses must map to these values
- Never use string literals - always use the enum

## Status Mapping

Different providers use different status values. Always use the mapping functions in `src/utils/status-mapping.ts`:

### Generic Mapping Function

```typescript
import { mapToDomainStatus } from '../utils/status-mapping';

// Safe for any provider
const domainStatus = mapToDomainStatus(providerStatus);
```

### Provider-Specific Functions

```typescript
// AniList
import { anilistToDomainStatus } from '../utils/status-mapping';
const status = anilistToDomainStatus(anilistStatus);

// ComicVine  
import { comicvineToDomainStatus } from '../utils/status-mapping';
const status = comicvineToDomainStatus(comicvineStatus);

// MangaDex
import { mangadexToDomainStatus } from '../utils/status-mapping';
const status = mangadexToDomainStatus(mangadexStatus);

// Fandom
import { fandomToDomainStatus } from '../utils/status-mapping';
const status = fandomToDomainStatus(fandomStatus);
```

## Common Mistakes to Avoid

### ❌ DON'T: Use String Literals
```typescript
// WRONG - Never use string literals
manga.status = 'ongoing';
manga.status = 'ONGOING';
```

### ✅ DO: Use Enum Values
```typescript
// CORRECT - Always use enum
import { MangaStatus } from '../types/domain/manga-types';
manga.status = MangaStatus.ONGOING;
```

### ❌ DON'T: Create New Status Enums
```typescript
// WRONG - Don't create new enums
enum MyMangaStatus {
  PUBLISHING = 'PUBLISHING',
  // ...
}
```

### ✅ DO: Map to Canonical Enum
```typescript
// CORRECT - Map provider values to domain enum
function mapProviderStatus(status: string): MangaStatus {
  return mapToDomainStatus(status);
}
```

### ❌ DON'T: Mix Database and Domain Status
```typescript
// WRONG - Database status is different
const dbStatus = manga.status; // This might be database enum
const domainStatus = dbStatus; // Type mismatch!
```

### ✅ DO: Convert Between Layers
```typescript
// CORRECT - Convert when crossing boundaries
const domainStatus = mapDatabaseStatusToDomain(dbStatus);
const dbStatus = mapDomainStatusToDatabase(domainStatus);
```

## Implementation Examples

### In Adapters
```typescript
export class AniListAdapter {
  private mapSearchResult(anilistManga: AniListManga): MangaSearchResult {
    return {
      id: String(anilistManga.id),
      title: anilistManga.title.romaji,
      // CORRECT: Map provider status to domain
      status: anilistToDomainStatus(anilistManga.status),
      // ... other fields
    };
  }
}
```

### In Components
```typescript
function MangaStatusBadge({ manga }: { manga: MangaEntity }) {
  // CORRECT: Use enum for comparisons
  const getStatusColor = () => {
    switch (manga.status) {
      case MangaStatus.ONGOING:
        return 'green';
      case MangaStatus.COMPLETED:
        return 'blue';
      case MangaStatus.HIATUS:
        return 'yellow';
      case MangaStatus.CANCELLED:
        return 'red';
      default:
        return 'gray';
    }
  };
  
  return <Badge color={getStatusColor()}>{manga.status}</Badge>;
}
```

### In Type Guards
```typescript
function isValidMangaStatus(status: unknown): status is MangaStatus {
  return (
    typeof status === 'string' &&
    Object.values(MangaStatus).includes(status as MangaStatus)
  );
}
```

## Migration Guide

If you find code using old patterns:

1. **Identify the pattern**:
   ```typescript
   // Old pattern examples:
   manga.status = 'ongoing';  // lowercase string
   manga.status = Status.ONGOING;  // wrong enum
   ```

2. **Import correct enum**:
   ```typescript
   import { MangaStatus } from '@/types/domain/manga-types';
   ```

3. **Update the code**:
   ```typescript
   manga.status = MangaStatus.ONGOING;
   ```

4. **Use mapping for external data**:
   ```typescript
   manga.status = mapToDomainStatus(externalStatus);
   ```

## Related Documentation

- `src/types/domain/manga-types.ts` - Canonical enum definition
- `src/utils/status-mapping.ts` - Mapping utilities
- `docs/type-reference.md` - Visual type reference

## Deprecated Documentation

The following files are DEPRECATED - do not use:
- `manga-status-standardization.md` 
- `status-mapping-standardization.md`
- `status-mapping-fixes.md`
- Any file with "status" in the name not listed above

---

**Remember**: When in doubt, check the source code at `src/types/domain/manga-types.ts`. The code is the ultimate truth.
