# Pattern Migration Guide

> 📚 **Canonical Documentation**: This guide helps you migrate from deprecated patterns to standardized approaches.
>
> Last Updated: January 2025

## Overview

This guide provides step-by-step instructions for migrating from old patterns to the standardized patterns established during the documentation consolidation effort.

## Table of Contents

1. [MangaStatus Enum Migration](#mangastatus-enum-migration)
2. [Adapter Pattern Migration](#adapter-pattern-migration)
3. [AsyncResult Pattern Migration](#asyncresult-pattern-migration)
4. [AniList Integration Migration](#anilist-integration-migration)
5. [Authentication System Migration](#authentication-system-migration)
6. [Type System Migration](#type-system-migration)

---

## MangaStatus Enum Migration

### Old Pattern (Deprecated)
```typescript
// ❌ WRONG - Lowercase values
enum MangaStatus {
  ongoing = "ongoing",
  completed = "completed",
  hiatus = "hiatus",
  cancelled = "cancelled"
}

// ❌ WRONG - Direct string literals
const status = "ongoing";
```

### New Pattern (Standardized)
```typescript
// ✅ CORRECT - UPPERCASE values
enum MangaStatus {
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  HIATUS = "HIATUS",
  CANCELLED = "CANCELLED",
  DROPPED = "DROPPED"
}

// ✅ CORRECT - Use enum
const status = MangaStatus.ONGOING;
```

### Migration Steps

1. **Update enum definitions:**
   ```typescript
   // Before
   export enum MangaStatus {
     ongoing = "ongoing",
     completed = "completed"
   }
   
   // After
   export enum MangaStatus {
     ONGOING = "ONGOING",
     COMPLETED = "COMPLETED"
   }
   ```

2. **Update all usages:**
   ```typescript
   // Before
   if (manga.status === "ongoing") { }
   
   // After
   if (manga.status === MangaStatus.ONGOING) { }
   ```

3. **Use mapping functions for external data:**
   ```typescript
   import { mapExternalStatusToDomain } from '@/utils/status-mapping';
   
   // When receiving data from external sources
   const domainStatus = mapExternalStatusToDomain(externalStatus);
   ```

### Common Gotchas

- Database may still use lowercase - use mapping functions
- External APIs may use different values - always map
- TypeScript will catch most issues during compilation

**Reference**: manga-status-standardization-final.md

---

## Adapter Pattern Migration

### Old Pattern (Deprecated)
```typescript
// ❌ WRONG - Direct async/Promise pattern
export class OldAdapter implements IAdapter {
  async search(query: string): Promise<SearchResult[]> {
    try {
      const results = await api.search(query);
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }
}
```

### New Pattern (Standardized)
```typescript
// ✅ CORRECT - Dual-method pattern
export class NewAdapter implements IAdapter {
  // Private method returns AsyncResult
  private async searchInternal(query: string): Promise<AsyncResult<SearchResult[]>> {
    try {
      const results = await api.search(query);
      return { 
        success: true, 
        data: results,
        metadata: { timestamp: Date.now() }
      };
    } catch (error) {
      return { 
        success: false, 
        error: {
          code: 'SEARCH_ERROR',
          message: error.message,
          details: error
        }
      };
    }
  }
  
  // Public method throws for backward compatibility
  async search(query: string): Promise<SearchResult[]> {
    const result = await this.searchInternal(query);
    if (!result.success) {
      throw new AdapterError(result.error.message, result.error.code);
    }
    return result.data;
  }
}
```

### Migration Steps

1. **Create internal methods returning AsyncResult:**
   ```typescript
   private async fetchInternal(id: string): Promise<AsyncResult<Manga>> {
     // Implementation
   }
   ```

2. **Keep public methods for compatibility:**
   ```typescript
   async fetch(id: string): Promise<Manga> {
     const result = await this.fetchInternal(id);
     if (!result.success) {
       throw new AdapterError(result.error.message);
     }
     return result.data;
   }
   ```

3. **Update error handling:**
   ```typescript
   // Use standardized error types
   import { AdapterError, ValidationError } from '@/types/errors';
   ```

**Reference**: adapter-pattern-unified.md

---

## AsyncResult Pattern Migration

### Old Pattern (Deprecated)
```typescript
// ❌ WRONG - Inconsistent result types
type Result<T> = {
  data?: T;
  error?: string;
}

// ❌ WRONG - Boolean success with optional fields
type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: Error;
}
```

### New Pattern (Standardized)
```typescript
// ✅ CORRECT - 4-state AsyncResult pattern
type AsyncResult<T> = 
  | { success: true; data: T; metadata?: Record<string, any> }
  | { success: false; error: ErrorInfo }
  | { loading: true; progress?: number }
  | { cancelled: true; reason?: string };

interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}
```

### Migration Steps

1. **Update type definitions:**
   ```typescript
   // Replace old result types with AsyncResult
   import { AsyncResult } from '@/types/shared/async-result';
   ```

2. **Update function signatures:**
   ```typescript
   // Before
   async function fetchData(): Promise<{ data?: Data; error?: string }> { }
   
   // After
   async function fetchData(): Promise<AsyncResult<Data>> { }
   ```

3. **Update result handling:**
   ```typescript
   // Before
   const result = await fetchData();
   if (result.error) {
     console.error(result.error);
   } else {
     processData(result.data);
   }
   
   // After
   const result = await fetchData();
   if (result.success) {
     processData(result.data);
   } else if ('error' in result) {
     console.error(result.error.message);
   }
   ```

**Reference**: async-result-standardization.md

---

## AniList Integration Migration

### Old Pattern (Deprecated)
```typescript
// ❌ WRONG - References to mangal CLI integration
import { MangalAniListProvider } from '@/providers/mangal-anilist';

// ❌ WRONG - Using mangal for metadata
const metadata = await mangal.getAniListMetadata(mangaId);
```

### New Pattern (Standardized)
```typescript
// ✅ CORRECT - Native AniList integration only
import { AniListService } from '@/server/services/anilist';

// ✅ CORRECT - Direct GraphQL queries
const metadata = await aniListService.getMangaById(aniListId);
```

### Migration Steps

1. **Remove mangal metadata calls:**
   ```typescript
   // Before
   const provider = new MangalAniListProvider();
   const data = await provider.search(query);
   
   // After
   const service = new AniListService();
   const data = await service.search(query);
   ```

2. **Use native GraphQL queries:**
   ```typescript
   import { MANGA_DETAILS_QUERY } from '@/server/queries/anilist';
   
   const response = await aniListClient.query({
     query: MANGA_DETAILS_QUERY,
     variables: { id: mangaId }
   });
   ```

3. **Update configuration:**
   ```typescript
   // Remove mangal-specific AniList settings
   // Use only native AniList configuration
   ```

**Reference**: anilist-native-guide.md

---

## Authentication System Migration

### Old Pattern (Deprecated)
```typescript
// ❌ WRONG - Lucia Auth references
import { lucia } from '@/server/auth/lucia';
import type { Session } from 'lucia';

// ❌ WRONG - Lucia session handling
const session = await lucia.validateSession(sessionId);
```

### New Pattern (Standardized)
```typescript
// ✅ CORRECT - NextAuth.js/Auth.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/server/auth';

// ✅ CORRECT - NextAuth session handling
const session = await getServerSession(authOptions);
```

### Migration Steps

1. **Update imports:**
   ```typescript
   // Remove all Lucia imports
   // Add NextAuth imports
   import { signIn, signOut, useSession } from 'next-auth/react';
   ```

2. **Update session handling:**
   ```typescript
   // Before (Lucia)
   const { user, session } = await lucia.validateRequest(request);
   
   // After (NextAuth)
   const session = await getServerSession(authOptions);
   const user = session?.user;
   ```

3. **Update middleware:**
   ```typescript
   // Use NextAuth middleware
   export { default } from 'next-auth/middleware';
   
   export const config = {
     matcher: ['/api/protected/:path*']
   };
   ```

**Reference**: authentication-standardization.md

---

## Type System Migration

### Old Pattern (Deprecated)
```typescript
// ❌ WRONG - Non-existent directories
import { MangaDTO } from '@/types/dto/manga';
import { formatDate } from '@/types/utils/date';
import { ApiResponse } from '@/types/api/response';
```

### New Pattern (Standardized)
```typescript
// ✅ CORRECT - Actual directory structure
import { Manga } from '@/types/domain/manga';
import { formatDate } from '@/utils/date';  // Utils are separate
import { ApiResponse } from '@/types/shared/api';
```

### Migration Steps

1. **Update import paths:**
   ```typescript
   // Map old paths to new structure
   // /types/dto/* → /types/domain/*
   // /types/utils/* → /utils/*
   // /types/api/* → /types/shared/*
   ```

2. **Move utility functions:**
   ```typescript
   // Utilities don't belong in types directory
   // Move to src/utils/
   ```

3. **Use correct type directories:**
   - `types/domain/` - Domain models and entities
   - `types/adapters/` - Adapter interfaces and types
   - `types/shared/` - Shared types across the application
   - `types/services/` - Service-specific types

**Reference**: [type-system-architecture-standardization.md](../typescript/type-system-architecture-standardization.md)

---

## General Migration Tips

### 1. Use TypeScript to Your Advantage
- Enable strict mode to catch more issues
- Run `tsc --noEmit` to find type errors without building

### 2. Migrate Incrementally
- Start with one module or feature
- Test thoroughly before moving to the next
- Keep old code working during migration

### 3. Use Codemods Where Possible
```bash
# Example: Simple find and replace
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/MangaStatus\.ongoing/MangaStatus.ONGOING/g'
```

### 4. Update Tests First
- Migrate test files to new patterns
- This helps catch issues early
- Tests document expected behavior

### 5. Document Breaking Changes
- Update CHANGELOG.md
- Notify team members
- Provide migration scripts if needed

---

## Getting Help

If you encounter issues during migration:

1. Check the canonical documentation for the specific pattern
2. Look for examples in already-migrated code
3. Run validation scripts to catch common issues:
   ```bash
   node scripts/validation/validate-documentation.js
   ```

## Next Steps

After migrating your code:

1. Run all tests to ensure nothing is broken
2. Update any documentation you maintain
3. Remove references to deprecated patterns
4. Help others by sharing what you learned

---

**Remember**: The goal is consistency and maintainability. These patterns were chosen after careful analysis of the codebase and team needs.
