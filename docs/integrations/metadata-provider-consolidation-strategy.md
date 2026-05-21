# Metadata Provider Consolidation Strategy

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Provider Consolidation Strategy

---
# MetadataProvider Interface Consolidation Strategy

## Problem Analysis

We have 4 different `MetadataProvider` interfaces serving different architectural purposes:

### 1. Abstract Class (Behavioral Contract)
**Location**: `/src/api/base/MetadataProvider.ts`
- Abstract class that providers extend
- Defines methods: `search()`, `getManga()`, `getChapters()`, etc.
- Used by: AniList, MangaDex, Fandom, ComicVine clients

### 2. Provider Interface (Adapter Contract)
**Location**: `/src/types/provider-interfaces.ts`
- Interface extending `BaseProvider`
- Defines methods for adapters
- Used by: Integration adapters

### 3. Domain Model (Data Structure)
**Location**: `/src/types/domain/provider-types.ts`
- Data structure for provider information
- Properties: id, name, status, config
- Used by: UI components, settings

### 4. Storage Model (Database Structure)
**Location**: `/src/types/metadata-types.ts`
- How providers are stored in database
- Properties: timestamps, metadata, lastUsed
- Used by: Database operations

## Recommended Solution

### DO NOT MERGE - Use Namespace Organization

Since these interfaces serve fundamentally different purposes in the architecture, merging them would violate the Single Responsibility Principle. Instead, we should:

1. **Rename for Clarity**
2. **Organize with Namespaces**
3. **Update Imports Systematically**

### Proposed Naming Convention

```typescript
// 1. Behavioral Contract (Abstract Class)
// KEEP AS IS: /src/api/base/MetadataProvider.ts
export abstract class MetadataProvider { ... }

// 2. Adapter Interface
// RENAME IN: /src/types/provider-interfaces.ts
export interface IMetadataProviderAdapter extends BaseProvider { ... }

// 3. Domain Model
// RENAME IN: /src/types/domain/provider-types.ts
export interface MetadataProviderInfo { ... }

// 4. Storage Model
// RENAME IN: /src/types/metadata-types.ts
export interface MetadataProviderRecord { ... }
```

### Implementation Steps

1. **Update Interface Names**
   - `MetadataProvider` (interface) → `IMetadataProviderAdapter`
   - `MetadataProvider` (domain) → `MetadataProviderInfo`
   - `MetadataProvider` (storage) → `MetadataProviderRecord`

2. **Create Type Aliases for Migration**
   ```typescript
   // Temporary compatibility
   export type MetadataProvider = MetadataProviderInfo;
   ```

3. **Update Imports Gradually**
   - Phase 1: Add new names alongside old
   - Phase 2: Update all imports
   - Phase 3: Remove old names

## Benefits of This Approach

1. **Preserves Architecture**: Each interface maintains its specific purpose
2. **Clear Naming**: No confusion about which type to use where
3. **Gradual Migration**: Can be done incrementally without breaking changes
4. **Type Safety**: TypeScript will catch any missed updates

## Alternative Approach (Not Recommended)

If we were to merge, we would need:
- A single "god interface" with all properties (violates SRP)
- Complex conditional types for different contexts
- Loss of clear architectural boundaries

## Next Steps

1. Start with renaming interfaces
2. Update imports in order of dependency
3. Test each phase thoroughly
4. Document the new naming convention