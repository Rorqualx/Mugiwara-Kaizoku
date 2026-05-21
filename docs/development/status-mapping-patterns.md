# Status Mapping Patterns

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Status Mapping Patterns

---
# Status Mapping Patterns

This document describes the patterns and best practices for handling status mapping between different parts of the application.

## Overview

The application uses several different status enum types, which need to be carefully mapped between each other:

1. **Domain MangaStatus** (`src/types/domain/manga-types.ts`) - The canonical representation used in domain entities
2. **Common MangaStatus** (`src/types/common.ts`) - String literal union type used in legacy interfaces
3. **Prisma MangaStatus** - Generated from the database schema
4. **Client MangaStatus** - Used in UI components
5. **Provider-specific status values** - Raw strings from external services

## Status Type Disambiguation

When importing multiple status types, use type aliases to clearly distinguish between them:

```typescript
import { MangaStatus as DomainMangaStatus } from '../types/domain/manga-types';
import { MangaMetadata, MangaStatus as CommonMangaStatus } from '../types/common';
```

## Type-Safe Status Mapping

When mapping between status types, always use explicit type casts to ensure type safety:

```typescript
// Mapping from Domain to Common status
return 'ACTIVE' as CommonMangaStatus;

// Mapping from string to Domain status
return DomainMangaStatus.ONGOING;
```

## Safe Property Access

When accessing status properties from external data, use safe access patterns with proper type handling:

```typescript
// Extract status with fallback and type safety
const status = manga.status 
  ? mapFandomStatusToDomain(String(manga.status)) 
  : DomainMangaStatus.UNKNOWN;
```

## Type-Safe Status Assignment

When assigning status values to objects, use explicit type casts:

```typescript
// Create properly typed MangaMetadata
const mangaMetadata: MangaMetadata = {
  // ...
  status: ((result.metadata?.status as unknown as string) || 'PENDING') as CommonMangaStatus,
  // ...
};
```

## Utility Functions

Use the utility functions in `src/utils/status-mapping.ts` for consistent status mapping:

1. `mapToDomainStatus(providerStatus: unknown): DomainMangaStatus` - Convert any status to domain status
2. `mapDomainToCommonStatus(status: DomainMangaStatus): CommonMangaStatus` - Convert domain to common status
3. `safeMapDomainToCommonStatus(status?: DomainMangaStatus | null): CommonMangaStatus` - Safely handle optional status
4. `toCommonMangaStatus(status: unknown): CommonMangaStatus` - Safely convert any status to common status

## Common Patterns

### 1. Provider Adapter Pattern

When implementing provider adapters, use the following pattern:

```typescript
protected override mapStatus(providerStatus: unknown): DomainMangaStatus {
  if (!providerStatus) return DomainMangaStatus.UNKNOWN;
  
  // Provider-specific mapping
  return mapProviderToDomainStatus(String(providerStatus));
}
```

### 2. Metadata Object Creation Pattern

When creating metadata objects, use:

```typescript
return {
  // ...
  status: ((statusValue as unknown as string) || 'PENDING') as CommonMangaStatus,
  metadata: {
    // ...
    status: String(domainStatus), // Convert enum to string
    // ...
  }
};
```

### 3. Status Validation Pattern

When validating status values:

```typescript
export function isValidMangaStatus(value: unknown): value is DomainMangaStatus {
  if (typeof value !== 'string') {
    return false;
  }
  
  return Object.values(DomainMangaStatus).includes(value as DomainMangaStatus);
}
```

## Best Practices

1. Always use typed enums for domain status values
2. Use explicit type casts when assigning string literals to enum types
3. Always check for null/undefined before accessing status properties
4. Use mapping functions to ensure consistent status conversion
5. Avoid direct string assignments to status fields without type casting
6. Use proper type aliases to avoid name conflicts

## Migration Strategy

When migrating legacy code to use proper status types:

1. Add type aliases to clarify which status type is being used
2. Replace direct string assignments with proper mapping functions
3. Use explicit type casts when assigning to status fields
4. Add validation before accessing potentially undefined status values
5. Use the new utility functions for consistent handling