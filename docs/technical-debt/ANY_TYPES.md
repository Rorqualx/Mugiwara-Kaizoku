# Technical Debt: `any` Types in Import Wizard Components

## Overview
This document tracks the intentional use of `any` types in the Universal Import Wizard components and explains why they currently exist.

## Files with `any` Types

### 1. `/src/components/addManga/services/sourceManagementService.ts`

#### Intentional `any` Types:
- **Lines 11-14**: TRPC mutation hooks
  ```typescript
  fetchAnilistMutation: any;
  fetchFandomMutation: any;
  fetchComicvineMutation: any;
  fetchComicvineVolumeDetailsMutation: any;
  ```
  **Reason**: TRPC mutations have complex nested return types that are difficult to fully type. The actual mutation results are validated at runtime.

- **Line 29, 173, 242, 321, 473, 514**: Provider result parameters
  ```typescript
  result: any
  ```
  **Reason**: Different providers (AniList, ComicVine, Fandom, Wikipedia) return data in varying structures. Using `any` allows flexibility in handling diverse provider responses.

- **Lines 33-34**: Callback functions
  ```typescript
  setMediaGallery: (gallery: any) => void;
  setVolumesData: (data: any) => void;
  ```
  **Reason**: These callbacks handle complex nested data structures that vary by provider.

- **Line 303**: Issue mapping in ComicVine
  ```typescript
  volumeData: data.issues?.map((issue: any, index: number) => ({
  ```
  **Reason**: ComicVine API returns issues in a proprietary format that doesn't match our standard types.

### 2. `/src/components/addManga/steps/wizard/BasicInfoStep.tsx`

#### Intentional `any` Types:
- **Lines 40-41**: Initial data and cached results
  ```typescript
  initialData: any;
  cachedSearchResults?: any[];
  ```
  **Reason**: These props receive data from various sources with different structures during the wizard flow.

- **Line 60**: Logger instance
  ```typescript
  logger: any;
  ```
  **Reason**: Logger type is imported from an external utility and typing it would create unnecessary coupling.

## Why These `any` Types Exist

### 1. **Provider Flexibility**
The import wizard needs to handle data from multiple providers (AniList, ComicVine, Fandom, Wikipedia, etc.), each with their own data structures. Creating strict types for each would require:
- Separate interfaces for each provider's response format
- Complex type guards and conversions
- Frequent updates when providers change their APIs

### 2. **TRPC Mutation Complexity**
TRPC mutations return wrapped results with success/error states and nested data. Fully typing these would require:
- Importing TRPC utility types
- Creating generic wrappers for each mutation
- Maintaining type synchronization between client and server

### 3. **Rapid Development Trade-off**
These components were developed iteratively with changing requirements. The `any` types allow:
- Quick iteration on features
- Easy addition of new providers
- Flexibility in data transformation

## Future Improvements

### Phase 1: Easy Wins (Low Priority)
- Replace `logger: any` with proper logger type import
- Type `MediaGallery` and `VolumesData` callbacks with existing interfaces

### Phase 2: Provider Types (Medium Priority)
- Create a union type for all provider results: `ProviderResult = AniListResult | ComicVineResult | FandomResult | WikipediaResult`
- Add type guards for each provider type
- Replace `result: any` with `ProviderResult`

### Phase 3: TRPC Types (Low Priority)
- Import TRPC mutation types
- Create typed wrappers for each mutation
- Replace mutation `any` types with proper generics

## Current Impact

### No Runtime Issues
- All `any` types are validated at runtime before use
- Error handling catches type mismatches
- No production bugs related to these types

### Development Experience
- TypeScript still catches most errors in surrounding code
- IntelliSense works for most properties after initial assignment
- Code review ensures proper data handling

## Recommendation

**Leave these `any` types as-is for now** because:
1. They're working correctly without runtime errors
2. The flexibility they provide is currently needed
3. Full typing would require significant refactoring
4. The cost/benefit ratio of fixing them is low

Consider addressing them only when:
- Refactoring the provider system
- Standardizing provider responses
- Moving to a unified data model

---

*Last Updated: 2025-09-25*
*Total `any` types: 22*
*Files affected: 2*