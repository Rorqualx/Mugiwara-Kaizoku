# Duplicate Types Resolution Plan

## Identified Duplicates and Resolution Strategy

### 1. KapowarrConfig (6 definitions found)

**Duplicate Locations:**
1. `src/types/kapowarr-types.ts:14` - extends BaseIntegrationConfig ✅ **CANONICAL**
2. `src/types/adapters/kapowarr.ts:158` - extends KapowarrAdapterConfig (duplicate)
3. `src/types/adapters/kapowarr.ts:166` - extends BaseAdapterConfig (duplicate)
4. `src/types/canonical/kapowarr.types.ts:97` - standalone interface (incomplete)
5. `src/types/canonical/compatibility-exports.ts:16` - type alias placeholder
6. `src/types/canonical/compatibility-exports.ts:479` - schema placeholder

**Resolution:**
- **KEEP**: `src/types/kapowarr-types.ts:14` as the canonical definition
- **REMOVE**: All other definitions
- **UPDATE**: compatibility-exports.ts to re-export from kapowarr-types.ts

### 2. MangaEntity (Multiple definitions)

**Duplicate Locations:**
1. `src/types/canonical/entities.types.ts:14` - extends MangaMetadata ✅ **CANONICAL**
2. `src/types/canonical/compatibility-exports.ts:13` - re-export (correct)
3. `src/types/clientTypes.ts:168` - type alias to MangaEntity (keep for compatibility)

**Resolution:**
- **KEEP**: `src/types/canonical/entities.types.ts:14` as canonical
- **UPDATE**: Ensure all imports use the canonical version

### 3. EnhancedProviderResult (Duplicate interfaces in same file)

**Location:** `src/types/canonical/enhanced-metadata.types.ts`
- Line 260: First definition with basic properties
- Appears to have been intended as a single definition but formatted incorrectly

**Resolution:**
- **MERGE**: Combine into single, complete interface

### 4. Type Export Conflicts

**Issues in `src/types/canonical/index.ts`:**
- Trying to export non-existent types from kapowarr.types
- Missing proper type export syntax

**Resolution:**
- Audit actual exports from each file
- Update index.ts to match reality

## Implementation Steps

### Step 1: Fix KapowarrConfig