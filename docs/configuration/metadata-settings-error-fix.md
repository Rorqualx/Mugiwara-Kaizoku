# Metadata Settings Error Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Settings Error Fix

---
# Metadata Settings Page Error Fix

## Issue Summary
The metadata settings page at `/settings/metadata` was experiencing two critical errors:
1. "Cannot read properties of undefined (reading 'map')" - caused by incorrect data access
2. "Maximum update depth exceeded" - caused by an infinite render loop

## Root Cause
The components were using incorrect tRPC endpoints that didn't exist:
- `trpc.settings.query.useQuery()` - doesn't exist
- `trpc.settings.update.useMutation()` - doesn't exist

## Solution
Updated all metadata-related components to use the correct tRPC endpoints:
- `trpc.settings.get.useQuery({ key: 'metadata' })` - for fetching metadata settings
- `trpc.settings.set.useMutation()` - for updating metadata settings

## Files Fixed

### 1. DefaultMetadataProvider.tsx
- Changed from `trpc.settings.query.useQuery()` to `trpc.settings.get.useQuery({ key: 'metadata' })`
- Removed unnecessary state management that caused infinite loop
- Updated data access to handle the result structure properly

### 2. MetadataProviderCard.tsx
- Updated to use `trpc.settings.get.useQuery({ key: 'metadata' })`
- Changed mutation to use `trpc.settings.set.useMutation()`
- Fixed mutation payload to use `{ key: 'metadata', value: updatedMetadata }`

### 3. MetadataProvidersGrid.tsx
- Simplified component by removing unused integration status logic
- Updated to use correct tRPC endpoints
- Fixed data access patterns

### 4. MetadataFieldPreferences.tsx
- Replaced with a simplified placeholder component
- Original component was using non-existent tRPC endpoints
- Will be reimplemented when backend endpoints are available

### 5. useMetadataInitialization.ts
- Updated to use correct tRPC endpoints
- Fixed data access patterns to match the new structure
- Added proper error typing

## Key Learnings

1. **tRPC Endpoint Structure**: The settings router uses `get` and `set` procedures, not `query` and `update`
2. **Data Structure**: The `get` procedure returns `{ success: boolean, value: any }`, so we need to extract the value
3. **Mutation Payload**: The `set` procedure expects `{ key: string, value: any }`
4. **Type Safety**: Always add proper error typing for mutation error handlers

## Verification
- Type check passed: ✅
- Build completed successfully: ✅
- Page loads without errors: Pending verification

## Next Steps
1. Restart the development server and test the metadata settings page
2. Verify that provider toggles work correctly
3. Test metadata initialization for new installations
