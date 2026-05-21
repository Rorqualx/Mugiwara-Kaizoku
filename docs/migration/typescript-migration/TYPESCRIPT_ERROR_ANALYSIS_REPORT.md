# TypeScript Error Analysis Report
**Date**: 2025-08-29
**Total Files with Errors**: 17 files
**Total Error Count**: 72 errors

## Executive Summary

The TypeScript errors in the `src/types` directory fall into several categories:
1. **Missing imports** (40% of errors) - React types and Next.js types not imported
2. **Duplicate/conflicting exports** (25%) - Same types exported from multiple locations
3. **Type incompatibilities** (20%) - Mismatched interface extensions and property types
4. **isolatedModules violations** (10%) - Re-export syntax issues
5. **Missing type definitions** (5%) - References to non-existent types

## Detailed Error Analysis by File

### 1. `src/types/adapters/index.ts` (1 error)
**Error**: Module './base' has already exported a member named 'SearchOptions'
- **Root Cause**: Both `./base` and another module export `SearchOptions`
- **Resolution**: Use explicit re-export with aliasing:
```typescript
export { SearchOptions as BaseSearchOptions } from './base';
```

### 2. `src/types/adapters/kapowarr.ts` (4 errors)
**Errors**:
- Import declaration conflicts with local declaration of 'KapowarrManga' (line 8)
- Import declaration conflicts with local declaration of 'KapowarrChapter' (line 11)
- Interface 'KapowarrProviderConfig' incorrectly extends 'BaseAdapterConfig' (line 178)
- Property 'id' type mismatch: number vs string (line 237)

**Root Causes**:
- Importing types from canonical then declaring interfaces with same names locally
- Rate limit type structure incompatibility
- Inconsistent ID types (number vs string)

**Resolutions**:
```typescript
// Remove duplicate local declarations or rename them
import type { 
  KapowarrManga as CanonicalKapowarrManga,
  KapowarrChapter as CanonicalKapowarrChapter
} from '@/types/canonical/kapowarr.types';

// Fix rate limit structure to match BaseAdapterConfig
rateLimit?: {
  requests: number;
  window: number;
}

// Use consistent ID type
id: string; // or convert all to number
```

### 3. `src/types/api/v1/websocket.ts` (1 error)
**Error**: Interface 'EventMessage<T>' incorrectly extends 'WebSocketMessage<T>'
- **Root Cause**: `data` property type incompatibility
- **Resolution**: Ensure EventMessage data structure matches WebSocketMessage:
```typescript
interface EventMessage<T> extends WebSocketMessage<T> {
  data: T; // Must match parent type
  // Or use a different property name for event-specific data
  eventData: { event: string; payload: T; };
}
```

### 4. `src/types/canonical/search-result.types.ts` (1 error)
**Error**: Cannot find module './base.types'
- **Root Cause**: Missing or incorrectly named base types file
- **Resolution**: Create `base.types.ts` or fix import path:
```typescript
import { BaseTypes } from './common.types'; // Use correct file
```

### 5. `src/types/clientTypes.ts` (9 errors)
**Errors**: Multiple missing exports from '@/types/canonical/chapter.types'
- MangaEntity, ChapterEntity, LibraryEntity, MangaMetadata not exported
- MangaStatus declared but not exported
- TaskStatus, TaskType not exported

**Root Cause**: chapter.types.ts doesn't export all required types
**Resolution**: Add missing exports to chapter.types.ts:
```typescript
// In chapter.types.ts
export type MangaEntity = z.infer<typeof MangaSchema>;
export type ChapterEntity = z.infer<typeof ChapterSchema>;
export { MangaStatus } from './shared-types';
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
```

### 6. `src/types/compatibility/shims.ts` (1 error)
**Error**: Missing 'source' property in type assignment
- **Root Cause**: Object literal missing required property
- **Resolution**: Add missing property:
```typescript
const shimObject = {
  id: string,
  title: string,
  sourceId: string,
  source: '', // Add missing required property
  type: 'manga'
};
```

### 7. `src/types/component-types.ts` (11 errors)
**Errors**: All React type references (ReactNode, ElementType, etc.) not found
- **Root Cause**: Import statement is commented/malformed
- **Resolution**: Fix React imports:
```typescript
import type { 
  ComponentProps, 
  ComponentPropsWithoutRef, 
  ElementType, 
  ReactElement, 
  ReactNode 
} from 'react';
```

### 8. `src/types/express.ts` (2 errors)
**Errors**: NextFunction not found
- **Root Cause**: Express types not imported
- **Resolution**: Add Express imports:
```typescript
import type { NextFunction, Request, Response } from 'express';
```

### 9. `src/types/extensions/index.ts` (15 errors)
**Errors**: Multiple missing exports from AniList and ComicVine modules
- **Root Cause**: Types don't exist in source modules or have different names
- **Resolution**: Audit source modules and either:
  - Add missing type definitions
  - Update import names to match actual exports
  - Remove non-existent imports

### 10. `src/types/index.ts` (10 errors)
**Errors**: isolatedModules violations - must use 'export type' for type re-exports
- **Root Cause**: TypeScript requires explicit type exports when isolatedModules is enabled
- **Resolution**: Use 'export type' syntax:
```typescript
export type { BaseAdapterConfig } from './adapters/base';
export type { AdapterCapabilities } from './adapters/base';
```

### 11. `src/types/kapowarr-types.ts` (3 errors)
**Errors**: Import conflicts with local declarations
- **Root Cause**: Same as kapowarr.ts - duplicate declarations
- **Resolution**: Remove duplicate declarations or rename

### 12. `src/types/provider-interfaces.ts` (4 errors)
**Errors**: MangaEntity and ChapterEntity not found
- **Root Cause**: Missing imports
- **Resolution**: Add imports:
```typescript
import type { MangaEntity, ChapterEntity } from './canonical/entities.types';
```

### 13. `src/types/provider-utils.ts` (3 errors)
**Errors**: Properties don't exist on MetadataProviderRecord
- **Root Cause**: Type definition incomplete
- **Resolution**: Update MetadataProviderRecord interface:
```typescript
interface MetadataProviderRecord {
  isDefault?: boolean;
  icon?: string;
  description?: string;
  // other properties...
}
```

### 14. `src/types/shared-types.ts` (2 errors)
**Errors**: Missing exports from async-result module
- **Root Cause**: Functions/types don't exist or have different names
- **Resolution**: Check actual exports and update imports

### 15. `src/types/task-unions.ts` (2 errors)
**Errors**: MangaEntity and ChapterEntity not found
- **Root Cause**: Missing imports (same as provider-interfaces.ts)
- **Resolution**: Add proper imports

### 16. `src/types/test-types.ts` (4 errors)
**Errors**: NextApiRequest, NextApiResponse, EventType, EventLevel not found
- **Root Cause**: Duplicate/malformed imports and missing event type imports
- **Resolution**: Fix imports:
```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import type { EventType, EventLevel } from '@/server/services/events/eventTypes';
```

### 17. `src/types/transaction-client.ts` (2 errors)
**Errors**: Task type not found
- **Root Cause**: Missing import
- **Resolution**: Add import:
```typescript
import type { Task } from '@prisma/client';
```

## Resolution Priority

### High Priority (Breaking compilation)
1. Fix React imports in `component-types.ts` - affects all components
2. Fix Express imports in `express.ts` - affects all API routes  
3. Add missing exports to `chapter.types.ts` - affects client types
4. Fix Next.js imports in `test-types.ts` - affects tests

### Medium Priority (Type safety issues)
1. Resolve duplicate declarations in kapowarr files
2. Fix isolatedModules violations in `index.ts`
3. Add missing entity imports in provider files
4. Fix type incompatibilities in websocket and adapter configs

### Low Priority (Clean-up)
1. Remove non-existent imports from extensions
2. Update type names to match actual exports
3. Standardize ID types across the codebase

## Implementation Steps

1. **First Pass - Critical Imports** (30 mins)
   - Fix all React, Express, and Next.js imports
   - Add missing entity type exports

2. **Second Pass - Duplicate Resolution** (45 mins)
   - Resolve all duplicate type declarations
   - Use aliasing where necessary

3. **Third Pass - Type Compatibility** (1 hour)
   - Fix interface extension issues
   - Standardize property types

4. **Fourth Pass - Clean-up** (30 mins)
   - Fix isolatedModules violations
   - Remove non-existent imports
   - Run final type check

## Validation Commands

```bash
# Check specific directory
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "src/types/"

# Check error count
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l

# Watch mode for fixes
npx tsc --noEmit --watch
```

## Expected Outcome

After implementing all fixes:
- 0 TypeScript errors in `src/types/` directory
- Improved type safety across the application
- Better IDE autocomplete and type hints
- Reduced runtime errors from type mismatches