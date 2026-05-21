# Kapowarr Typescript Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Typescript Fixes

---
# Kapowarr Integration - TypeScript Error Fixes

## Summary of Issues Found

After running `pnpm type-check`, several TypeScript errors were identified that need to be addressed:

### 1. Base Class Import Issues
- The base adapter class is `BaseIntegrationAdapter` from `MetadataIntegrationAdapter.ts`, not a separate file
- Need to update import paths

### 2. Interface Mismatches
- `IntegrationAdapter` expects `searchManga` to return `MangaMetadata[]`, not `MangaSearchResult[]`
- `getSourceInfo()` must return all required properties of `MetadataSourceInfo`

### 3. Missing Type Exports
- `IntegrationMangaData` is not exported from manga-types
- Several other types are missing or incorrectly referenced

### 4. Component Issues
- `showNotification` method doesn't exist on `UseNotificationResult`
- Several icon imports are incorrect
- Property names in selectors don't match interfaces

### 5. Enum Re-export Issues
- With `isolatedModules`, need to use `export type` for type re-exports

## Required Fixes

### Fix 1: Update Base Adapter Imports
In `baseKapowarrAdapter.ts`:
```typescript
// Change from:
import { BaseIntegrationAdapter } from '../base/BaseIntegrationAdapter';

// To:
import { BaseIntegrationAdapter } from '../base/MetadataIntegrationAdapter';
```

### Fix 2: Add Missing Log Method
The BaseIntegrationAdapter doesn't have a `log` method. Either:
1. Add it to the base class, or
2. Use console.log directly, or
3. Use the logger from config

### Fix 3: Fix Interface Compliance
Update methods to match the expected interface:
- `searchManga` should return `MangaMetadata[]`
- `getSourceInfo` must return complete `MetadataSourceInfo`

### Fix 4: Add Missing Type Exports
Add to `src/types/domain/manga-types.ts`:
```typescript
export interface IntegrationMangaData {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  genres?: string[];
  tags?: string[];
  authors?: string[];
}
```

### Fix 5: Fix HttpClient Usage
The HttpClient is being used incorrectly. Need to check its actual interface.

### Fix 6: Fix Component Notification Usage
Update components to use the correct notification API.

### Fix 7: Fix Enum Re-exports
Update `src/integrations/kapowarr/index.ts` to use `export type` for interfaces.

## Implementation Priority

1. **Critical**: Fix base class imports and missing types
2. **High**: Fix interface compliance issues
3. **Medium**: Fix component issues
4. **Low**: Fix re-export warnings

## Next Steps

1. Fix the base adapter import path
2. Add missing type exports to existing type files
3. Update methods to match expected interfaces
4. Fix component notification usage
5. Update enum re-exports

The Kapowarr integration foundation is solid, but needs these adjustments to properly integrate with the existing codebase architecture.
