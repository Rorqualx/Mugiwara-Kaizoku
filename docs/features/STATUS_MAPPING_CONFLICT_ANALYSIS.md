# Status Mapping Conflict Analysis

*Generated: January 2025*
*Status: Active*
*Canonical: Yes*

## Executive Summary

This analysis documents the different status mapping implementations found across the Mugiwara-Kaizoku codebase and provides a path to consolidation.

## Current State: Multiple Competing Implementations

### 1. **Central Status Mapping File** (`src/utils/mapping/status-mapping.ts`)
- **Location**: `/src/utils/mapping/status-mapping.ts`
- **Pattern**: Provider-specific functions with switch statements
- **Case Sensitivity**: Mixed (toLowerCase for some, toUpperCase for others)
- **Key Features**:
  - Separate functions per provider (anilistToDomainStatus, mangadexToDomainStatus, etc.)
  - Generic stringToDomainStatus function
  - Bidirectional mapping with domainToProviderStatus
  - Uses normalized string comparisons

```typescript
// Example from status-mapping.ts
case 'ONGOING':
case 'publishing':
case 'serialization':
  return MangaStatus.ONGOING;
```

### 2. **BaseIntegrationAdapter** (`src/utils/integration-adapter.ts`)
- **Location**: `/src/utils/integration-adapter.ts`
- **Pattern**: String.includes() checks
- **Case Sensitivity**: toLowerCase()
- **Issues**:
  - Uses substring matching which can cause false positives
  - Different status strings than central mapper
  
```typescript
// Problematic pattern - substring matching
if (status.includes('ONGOING') || status.includes('publishing')) {
  return MangaStatus.ONGOING;
}
```

### 3. **UnifiedParserAdapter** (`src/server/adapters/metadata/unifiedParserAdapter.ts`)
- **Location**: `/src/server/adapters/metadata/unifiedParserAdapter.ts`
- **Pattern**: Switch statement
- **Case Sensitivity**: toLowerCase()
- **Issues**:
  - Different case handling than central mapper
  - Missing some status mappings

```typescript
switch (statusStr) {
  case 'ONGOING':  // lowercase string but uppercase case label!
  case 'publishing':
  case 'active':
    return DomainMangaStatus.ONGOING;
```

### 4. **BaseMetadataAdapter** (`src/server/adapters/base-metadata-adapter.ts`)
- **Location**: `/src/server/adapters/base-metadata-adapter.ts`
- **Pattern**: Dictionary lookup with Record<string, MangaPublicationStatus>
- **Case Sensitivity**: toUpperCase()
- **Good Practice**: Clean mapping approach but duplicates central mapper

```typescript
const statusMap: Record<string, MangaPublicationStatus> = {
  'ONGOING': MangaPublicationStatus.ONGOING,
  'RELEASING': MangaPublicationStatus.ONGOING,
  // ...
};
```

### 5. **Manga Page Component** (`src/pages/manga/[id].tsx`)
- **Location**: `/src/pages/manga/[id].tsx`
- **Pattern**: if-else chain with includes()
- **Case Sensitivity**: toLowerCase()
- **Issues**:
  - Inline status mapping in component
  - Uses substring matching (error-prone)
  - Should use utility function

```typescript
const status = metaObj.status.toLowerCase();
if (status.includes('ONGOING') || status.includes('publishing')) {
  metadata.status = MangaPublicationStatus.ONGOING;
}
```

## Problems Identified

### 1. **Inconsistent Case Handling**
- Some use `toLowerCase()`, others use `toUpperCase()`
- Mixed case in switch statements (case 'ONGOING' with toLowerCase())
- Can cause missed matches

### 2. **Substring Matching Issues**
- Using `includes()` can match unintended strings
- Example: "discontinued" would match "continued" check
- False positives risk

### 3. **Duplication of Logic**
- Same mappings defined in 5+ places
- Maintenance nightmare - updates needed in multiple files
- Risk of divergence over time

### 4. **Different Status String Sets**
- Each implementation recognizes different status strings
- No comprehensive list of all possible status values
- Some providers missing mappings

### 5. **Type Safety Issues**
- Some use `unknown` type for input
- Others assume string without validation
- Inconsistent error handling

## Recommended Solution

### Phase 1: Consolidate to Central Mapper

1. **Enhance the existing central mapper** (`src/utils/mapping/status-mapping.ts`):
   - Add comprehensive status string mappings
   - Standardize case handling (recommend uppercase comparison)
   - Add validation and type guards
   - Include all provider variations

2. **Create a universal mapping function**:
```typescript
export function mapStatusToMangaStatus(
  status: unknown,
  provider?: string
): MangaPublicationStatus {
  // Type guard
  if (!status || typeof status !== 'string') {
    return MangaPublicationStatus.UNKNOWN;
  }
  
  // Provider-specific mapping if provided
  if (provider) {
    switch (provider.toLowerCase()) {
      case 'anilist':
        return anilistToDomainStatus(status);
      case 'mangadex':
        return mangadexToDomainStatus(status);
      // ... other providers
    }
  }
  
  // Generic mapping
  return stringToDomainStatus(status);
}
```

### Phase 2: Update All Implementations

Files to update:
1. ✅ `/src/utils/integration-adapter.ts` - Replace mapStatus method
2. ✅ `/src/server/adapters/metadata/unifiedParserAdapter.ts` - Use central mapper
3. ✅ `/src/server/adapters/base-metadata-adapter.ts` - Delegate to central mapper
4. ✅ `/src/pages/manga/[id].tsx` - Import and use central function
5. ✅ All other files with inline status mapping

### Phase 3: Add Type Safety

1. Create exhaustive status type:
```typescript
export const VALID_STATUS_STRINGS = [
  'ongoing', 'publishing', 'serialization', 'releasing', 'current',
  'completed', 'finished', 'ended', 'complete',
  'hiatus', 'on hold', 'paused', 'suspended',
  'cancelled', 'canceled', 'discontinued', 'abandoned',
  'upcoming', 'not_yet_released', 'tba'
] as const;

export type ValidStatusString = typeof VALID_STATUS_STRINGS[number];
```

2. Add validation function:
```typescript
export function isValidStatusString(status: unknown): status is ValidStatusString {
  return typeof status === 'string' && 
         VALID_STATUS_STRINGS.includes(status.toLowerCase() as ValidStatusString);
}
```

## Implementation Checklist

- [ ] Audit all status string variations across codebase
- [ ] Update central mapper with complete mappings
- [ ] Add bidirectional mapping support
- [ ] Create migration script to update all files
- [ ] Add unit tests for all status combinations
- [ ] Update documentation
- [ ] Add linting rule to prevent inline status mapping

## Status String Master List

Based on analysis, here are all status strings found:

### Ongoing/Active
- `ongoing`, `ONGOING`
- `publishing`, `PUBLISHING`
- `serialization`, `SERIALIZATION`
- `releasing`, `RELEASING`
- `current`, `CURRENT`
- `continuing`, `CONTINUING`
- `active`, `ACTIVE`

### Completed
- `completed`, `COMPLETED`
- `finished`, `FINISHED`
- `ended`, `ENDED`
- `complete`, `COMPLETE`

### Hiatus
- `hiatus`, `HIATUS`
- `on hold`, `ON_HOLD`, `on-hold`
- `paused`, `PAUSED`
- `suspended`, `SUSPENDED`

### Cancelled
- `cancelled`, `CANCELLED`
- `canceled`, `CANCELED`
- `discontinued`, `DISCONTINUED`
- `abandoned`, `ABANDONED`
- `dropped`, `DROPPED`

### Upcoming
- `upcoming`, `UPCOMING`
- `not_yet_released`, `NOT_YET_RELEASED`
- `tba`, `TBA`

## Testing Requirements

1. **Unit Tests**: Test all status string variations
2. **Integration Tests**: Verify provider-specific mappings
3. **Regression Tests**: Ensure existing functionality preserved
4. **Edge Cases**: 
   - Null/undefined inputs
   - Mixed case inputs
   - Unknown status strings
   - Special characters in status

## Migration Script

Create automated script to:
1. Find all status mapping occurrences
2. Replace with central mapper imports
3. Validate no functionality changes
4. Run tests to confirm

## Related Documentation

- `/docs/CONFLICTING_LOGIC_ANALYSIS.md`
- `/docs/CLAUDE.md`
- `/docs/status-system-guide.md`

## Conclusion

The status mapping conflicts are a HIGH PRIORITY issue that can cause:
- Database query failures (wrong enum values)
- UI inconsistencies (status displayed incorrectly)
- Data integrity issues (status saved incorrectly)

Consolidating to a single, well-tested status mapper will:
- Eliminate bugs from inconsistent mappings
- Reduce maintenance burden
- Improve code quality
- Ensure data consistency