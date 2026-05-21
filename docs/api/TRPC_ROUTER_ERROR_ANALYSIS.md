# TRPC Router TypeScript Error Analysis Report

## Executive Summary

Analysis of TypeScript errors in TRPC router files reveals **104 total errors** across 26 router files. The errors fall into several categories that require systematic resolution.

## Error Distribution by File

| File | Error Count | Severity |
|------|------------|----------|
| `src/server/trpc/routers/manga.ts` | 15 | HIGH |
| `src/server/trpc/routers/wanted.ts` | 13 | HIGH |
| `src/server/trpc/routers/config.ts` | 9 | MEDIUM |
| `src/server/trpc/routers/library-from-router.ts` | 5 | MEDIUM |
| `src/server/trpc/routers/bulk.ts` | 5 | MEDIUM |
| `src/server/trpc/routers/integrations/kavita.ts` | 5 | MEDIUM |
| `src/server/trpc/routers/backup.ts` | 4 | MEDIUM |
| `src/server/trpc/routers/events.ts` | 4 | MEDIUM |
| `src/server/trpc/routers/integrations/komga.ts` | 4 | MEDIUM |
| `src/server/trpc/routers/kapowarr.ts` | 4 | MEDIUM |
| `src/server/trpc/router.ts` | 4 | MEDIUM |
| `src/server/trpc/routers/settings.ts` | 5 | MEDIUM |
| `src/server/trpc/routers/suwayomi.ts` | 3 | LOW |
| `src/server/trpc/routers/system.ts` | 3 | LOW |
| Others | 1-2 each | LOW |

## Error Categories and Root Causes

### 1. Missing Type Exports (40% of errors)

**Pattern**: `Cannot find module or exported member`

**Affected Files**:
- `manga.ts`: Missing `DownloadMode`, `logInfo`, `logError`, `logWarning`, `EventType`, `EventSource`, `EventLevel`
- `wanted.ts`: Missing `DownloadHistoryStatus`, `WantedItemsResponse`, `MissingItemsResponse`, `DownloadHistoryResponse`
- `backup.ts`: Missing `BackupContent`, `BackupType`
- `calendar.ts`: Missing `CalendarFilters`
- `config.ts`: Missing `ConfigWithMetadata`

**Root Cause**: Types are defined in `compatibility-exports.ts` as placeholders but not properly exported from the main index.

**Resolution**:
```typescript
// src/types/canonical/index.ts
// Add these exports:
export {
  CalendarFilters,
  BackupContent,
  BackupType,
  WantedItemsResponse,
  MissingItemsResponse,
  DownloadHistoryResponse,
  DownloadHistoryStatus
} from './compatibility-exports';

// Define DownloadMode properly
export enum DownloadMode {
  SINGLE = 'SINGLE',
  BATCH = 'BATCH',
  AUTOMATIC = 'AUTOMATIC'
}
```

### 2. Property Does Not Exist (35% of errors)

**Pattern**: `Property 'X' does not exist on type 'Y'`

**Common Issues**:
- `apiKey` property missing on various config types
- `status` property missing on Chapter type
- `sourceId` vs `source` naming mismatch in SystemEvent
- `metadata` property missing on ReleaseSchedule

**Examples**:
```typescript
// Error: Property 'apiKey' does not exist
router.ts:94 - Property 'apiKey' does not exist on type '{ id: string; enabled: boolean; sourceType: "suwayomi"; }'
settings.ts:252 - Property 'apiKey' does not exist on type '{ providerId: string; enabled: boolean; }'
```

**Resolution**:
```typescript
// Update type definitions to include missing properties
interface ProviderConfig {
  id: string;
  enabled: boolean;
  sourceType: string;
  apiKey?: string; // Add optional apiKey
}

// Fix Chapter type to include status
interface Chapter {
  // ... existing properties
  status?: ChapterStatus;
}
```

### 3. Module Import Errors (15% of errors)

**Pattern**: `Cannot find module 'X' or its corresponding type declarations`

**Affected Imports**:
- `@/utils/db` - Module doesn't exist
- `@/utils/query-optimizer` - Module doesn't exist  
- `@/utils/integration` - Module doesn't exist
- `@/utils/metadataValidator` - Module doesn't exist
- `@/utils/system-event-logger` - Incorrect exports
- `@/utils/integration/kavita` - Module doesn't exist
- `@/utils/integration/komga` - Module doesn't exist

**Resolution**:
```typescript
// Fix system-event-logger exports
// src/utils/system-event-logger.ts
export { logInfo, logError, logWarning };
export { EventType, EventSource, EventLevel };

// Create missing modules or update imports to correct paths
// Replace @/utils/db with @/lib/prisma
// Replace @/utils/integration with actual service paths
```

### 4. Type Mismatches (10% of errors)

**Pattern**: `Type 'X' is not assignable to type 'Y'`

**Examples**:
- `Date` not assignable to `string`
- `number` not assignable to `string`
- Enum value mismatches

**Specific Cases**:
```typescript
manga.ts:827 - Type 'Date' is not assignable to type 'string'
wanted.ts:157 - Type 'number' is not assignable to type 'string'
```

**Resolution**:
```typescript
// Convert types appropriately
releaseDate: releaseDate instanceof Date ? releaseDate.toISOString() : releaseDate
// Or update type definitions to accept both
releaseDate: string | Date;
```

## Detailed Error Traces

### High Priority Errors (manga.ts)

1. **Missing DownloadMode enum**
   - Location: Line 4
   - Impact: Prevents download functionality
   - Fix: Define enum in canonical types

2. **System event logger exports**
   - Location: Line 23
   - Impact: Logging functionality broken
   - Fix: Update exports in system-event-logger module

3. **Date/string type mismatch**
   - Location: Line 827-829
   - Impact: Chapter release date handling
   - Fix: Type conversion or union type

### High Priority Errors (wanted.ts)

1. **Missing response types**
   - Location: Line 14
   - Impact: API response typing broken
   - Fix: Define proper response interfaces

2. **ID type mismatches**
   - Location: Line 157
   - Impact: Database query issues
   - Fix: Use toNumberId conversion utility

## Resolution Steps

### Phase 1: Fix Type Exports (Immediate)
1. Update `src/types/canonical/index.ts` to export all missing types
2. Define placeholder types properly in their respective files
3. Remove duplicate type definitions

### Phase 2: Fix Module Imports (Day 1)
1. Update all import paths to correct locations
2. Create missing utility modules or consolidate into existing ones
3. Fix export statements in utility modules

### Phase 3: Fix Property Issues (Day 2)
1. Update interface definitions to include missing properties
2. Add optional properties where appropriate
3. Fix property name mismatches (sourceId vs source)

### Phase 4: Fix Type Mismatches (Day 3)
1. Add type conversion utilities where needed
2. Update type definitions to use union types where appropriate
3. Ensure consistent type usage across the codebase

## Testing Strategy

1. **Unit Tests**: Test each router endpoint individually
2. **Integration Tests**: Test complete workflows
3. **Type Tests**: Use TypeScript's type checking in tests
4. **Runtime Tests**: Ensure no runtime errors from type issues

## Prevention Measures

1. **Strict TypeScript Config**: Enable stricter type checking
2. **Pre-commit Hooks**: Run type check before commits
3. **CI/CD Integration**: Fail builds on type errors
4. **Documentation**: Update canonical docs with type standards

## Conclusion

The majority of errors stem from incomplete type exports and missing module definitions. A systematic approach to fixing these issues, starting with type exports and moving through module imports and property definitions, will resolve most errors. The remaining type mismatches can be addressed with proper type conversions or updated type definitions.

**Estimated Resolution Time**: 3-4 days with proper testing
**Risk Level**: Medium - Most errors are compile-time only
**Priority**: HIGH - Blocks development and deployment