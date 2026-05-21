# Migration Plan: Fix useManga.ts TypeScript Errors

## Overview
This plan addresses 4 TypeScript errors in `src/hooks/useManga.ts` and consolidates duplicate type definitions by migrating to canonical types.

## Errors Identified

### 1. MonitoringConfig Issues (Lines 378, 379)
- **Error**: `notifyOnNew` property doesn't exist in canonical `MonitoringConfig`
- **Root Cause**: Multiple conflicting MonitoringConfig definitions across codebase
- **Current Canonical Definition** (`src/types/canonical/entity.types.ts`):
  - Has: `enabled`, `interval`, `autoDownload`, `notifications`
  - Missing: `notifyOnNew`, `isMonitored`

### 2. MangaStatus Type Mismatch (Lines 399, 410)
- **Error**: `MangaStatus` enum values incompatible with `MangaPublicationStatus`
- **Root Cause**: Mixed usage of processing statuses (PENDING, ACTIVE, ERROR) with publication statuses (ONGOING, COMPLETED, HIATUS)

## Duplicate Type Definitions Found

### MonitoringConfig Duplicates (7 different definitions):
1. `src/types/canonical/entity.types.ts` - CANONICAL ✓
2. `src/types/canonical/shared-types.ts` - DUPLICATE
3. `src/types/canonical/common-extended.types.ts` - DUPLICATE
4. `src/types/canonical/compatibility-exports.ts` - DUPLICATE
5. `src/components/updateManga/UpdateForm.tsx` - LOCAL
6. `src/components/addManga/steps/confirmationStep/hooks/useConfirmationState.ts` - LOCAL
7. `src/utils/converters/EntityConverter.ts` - LOCAL
8. `src/server/services/search/types.ts` - SERVER
9. `src/api/utils/provider-health-monitor.ts` - DIFFERENT PURPOSE

### MangaStatus Confusion:
- `MangaStatus` enum mixes publication and processing statuses
- `MangaPublicationStatus` for publication states (ONGOING, COMPLETED, etc.)
- `ClientMangaStatus` for processing states (PENDING, ACTIVE, ERROR)
- Need clear separation between publication status and processing status

## Migration Strategy

### Phase 1: Consolidate MonitoringConfig

#### Step 1.1: Update Canonical Definition
```typescript
// src/types/canonical/entity.types.ts
export interface MonitoringConfig {
  // Core monitoring
  enabled: boolean;
  interval?: number | string; // Support both number (hours) and string ('daily', 'weekly')
  
  // Download preferences
  autoDownload?: boolean;
  downloadNew?: boolean;
  
  // Notification preferences (replaces notifyOnNew)
  notifications?: boolean;
  
  // Quality preferences
  quality?: string;
  language?: string;
  
  // Filtering
  scanlators?: string[];
  excludeChapters?: string[];
  includeCompleted?: boolean;
  
  // Legacy support (deprecated)
  isMonitored?: boolean; // Maps to 'enabled'
  notifyOnNew?: boolean; // Maps to 'notifications'
}
```

#### Step 1.2: Remove Duplicate Definitions
- Delete MonitoringConfig from:
  - `shared-types.ts`
  - `common-extended.types.ts`
  - `compatibility-exports.ts`
  
#### Step 1.3: Update Local Definitions
- Convert local interfaces to use canonical import
- Add type converters where needed

### Phase 2: Fix MangaStatus Types

#### Step 2.1: Separate Concerns
```typescript
// Use MangaPublicationStatus for publication state
type PublicationStatus = MangaPublicationStatus;

// Use separate type for processing state
type ProcessingStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ERROR' | 'DELETED';
```

#### Step 2.2: Update useManga.ts
- Use correct status types based on context
- Add status conversion utilities

### Phase 3: Implementation

#### Step 3.1: Fix useManga.ts
```typescript
// Line 378 - Map legacy fields
const monitoringConfig: MonitoringConfig = {
  enabled: Boolean(updates.monitoringConfig?.enabled ?? updates.monitoringConfig?.isMonitored ?? true),
  interval: typeof updates.monitoringConfig?.interval === 'number' 
    ? updates.monitoringConfig.interval 
    : intervalMap[intervalString] || 24,
  notifications: Boolean(updates.monitoringConfig?.notifyOnNew ?? false), // Map notifyOnNew to notifications
  autoDownload: Boolean(updates.monitoringConfig?.autoDownload ?? false)
};

// Lines 399, 410 - Use proper status conversion
import { mapProcessingToPublication, mapPublicationToProcessing } from '@/utils/status-converters';
```

#### Step 3.2: Create Status Converters
```typescript
// src/utils/status-converters.ts
export function mapProcessingToPublication(status: ProcessingStatus): MangaPublicationStatus {
  const mapping = {
    'PENDING': MangaPublicationStatus.UNKNOWN,
    'ACTIVE': MangaPublicationStatus.ONGOING,
    'COMPLETED': MangaPublicationStatus.COMPLETED,
    'ERROR': MangaPublicationStatus.UNKNOWN,
    'DELETED': MangaPublicationStatus.CANCELLED
  };
  return mapping[status] || MangaPublicationStatus.UNKNOWN;
}
```

### Phase 4: Update Dependent Files

Files requiring updates:
1. `src/pages/manga/[id].tsx` - Remove notifyOnNew usage
2. `src/components/updateManga/UpdateForm.tsx` - Use canonical import
3. `src/components/addManga/steps/confirmationStep/hooks/useConfirmationState.ts` - Use canonical import
4. `src/utils/converters/EntityConverter.ts` - Use canonical import
5. `src/server/services/search/types.ts` - Align with canonical

### Phase 5: Remove Backwards Compatibility

1. Remove deprecated fields from interfaces
2. Remove legacy type exports
3. Update all imports to use canonical types
4. Remove type re-exports that create confusion

## Execution Order

1. **Update canonical MonitoringConfig** with all needed fields
2. **Fix useManga.ts errors** with proper field mapping
3. **Create status converter utilities**
4. **Update all MonitoringConfig imports** to use canonical
5. **Remove duplicate type definitions**
6. **Update dependent files** to use new structure
7. **Run type check** to verify all errors resolved
8. **Remove backwards compatibility layers**

## Success Criteria

- [ ] Zero TypeScript errors in `pnpm type-check`
- [ ] Single canonical MonitoringConfig definition
- [ ] Clear separation between publication and processing statuses
- [ ] All files using canonical type imports
- [ ] No duplicate type definitions
- [ ] No backwards compatibility layers

## Risk Mitigation

- Test each change incrementally
- Keep type converters for migration period
- Document breaking changes
- Update tests to match new types