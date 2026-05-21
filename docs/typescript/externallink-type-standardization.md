# Externallink Type Standardization

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Externallink Type Standardization

---
# ExternalLink Type Standardization

## Overview

This document describes the standardization of the `ExternalLink` type across the codebase. Previously, multiple incompatible `ExternalLink` interfaces existed in different modules, causing type compatibility issues, particularly in converter implementations.

## Issues Identified

1. **Type Incompatibility**: The `ExternalLink` interface was defined in multiple places:
   - In `src/utils/converters/MetadataConverter.ts` as a basic interface
   - In `src/utils/converters/providers/types/anilist.ts` as `AniListExternalLink` with additional properties
   - Used inconsistently across different converters

2. **Property Access Errors**: Incompatible property types between different `ExternalLink` definitions caused TypeScript errors:
   - "Types of property 'url' are incompatible" errors
   - Missing properties when passing links between components

## Implementation Strategy

### 1. Create Canonical Type Definition

Created a single, canonical `ExternalLink` interface in `src/types/domain/external-link.ts` that includes all necessary properties:

```typescript
export interface ExternalLink {
  /** The URL of the external link (required) */
  url: string;
  
  /** The name of the site or service (required) */
  site: string;
  
  /** Optional type categorization for the link */
  type?: string;
  
  /** Optional language of the linked content */
  language?: string;
  
  /** Optional color for UI display (hex code) */
  color?: string;
  
  /** Optional icon URL for the link */
  icon?: string;
}
```

### 2. Type Guards for Runtime Validation

Added type guards to validate `ExternalLink` objects at runtime:

```typescript
export function isExternalLink(obj: unknown): obj is ExternalLink {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'url' in obj &&
    typeof (obj as { url: unknown }).url === 'string' &&
    'site' in obj &&
    typeof (obj as { site: unknown }).site === 'string'
  );
}

export function isExternalLinkArray(arr: unknown): arr is ExternalLink[] {
  return (
    Array.isArray(arr) &&
    arr.every(isExternalLink)
  );
}
```

### 3. Refactor Converters to Use Canonical Type

Updated all converters to use the canonical `ExternalLink` type:

1. **MetadataConverter**:
   - Removed the local `ExternalLink` interface
   - Imported the canonical type from `src/types/domain/external-link.ts`

2. **AniListConverter**:
   - Updated imports to use the canonical type
   - Modified `getLinks()` method to include all available properties from AniList links

3. **ComicVineConverter**:
   - Updated imports to use the canonical type
   - Fixed the `getLinks()` method to return properly typed links

4. **MangaDexConverter**:
   - Updated imports to use the canonical type
   - Ensured the `getLinks()` method returns properly typed links

## Benefits of the Fix

1. **Type Consistency**: All converters now use the same `ExternalLink` type definition
2. **Improved Type Safety**: The canonical type includes all necessary properties with clear optional markers
3. **Better Documentation**: Each property is documented with JSDoc comments
4. **Runtime Validation**: Type guards allow validation of ExternalLink objects at runtime
5. **Extensibility**: New properties can be added to a single location when needed

## Future Considerations

1. **Extended Properties**: The ExternalLink type might need additional properties for specific providers in the future
2. **Validation Enhancement**: Consider adding more sophisticated validation for URLs and site names
3. **UI Integration**: Ensure UI components properly display all available link properties

By standardizing the `ExternalLink` type, we've improved type safety and consistency across the codebase while maintaining compatibility with all metadata providers.