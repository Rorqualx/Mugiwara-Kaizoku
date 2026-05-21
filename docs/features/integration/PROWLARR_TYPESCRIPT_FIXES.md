# PROWLARR_TYPESCRIPT_FIXES

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for PROWLARR_TYPESCRIPT_FIXES

---
# Prowlarr Integration TypeScript Fixes

## Issues Fixed

1. **ProwlarrConfig Property Mismatches**
   - The component was expecting properties on `prowlarrConfig` that are not returned from the API
   - Properties like `syncInterval`, `autoSync`, `preferredProtocol`, `minimumSeeders`, and `categories` were expected from the API but are actually local form state
   - **Fix**: Changed to use default values for these properties instead of expecting them from the API

2. **Indexer Type Mismatch**
   - There were two different `ProwlarrIndexer` types:
     - API type from `/src/types/prowlarr.ts` with `protocol: string`
     - Domain type from `/src/types/domain/integration-types.ts` with `protocol: 'torrent' | 'usenet'`
   - **Fix**: Added proper type mapping to convert the API response to the domain type

3. **Categories Property Type Issue**
   - TypeScript was having issues with the optional `categories` property on ProwlarrIndexer
   - **Fix**: Used type assertions to properly handle the optional categories field

4. **Unused Status Fields**
   - The component was trying to display `lastSyncTime`, `indexerCount`, and `enabledIndexerCount` that don't exist in the API response
   - **Fix**: Commented out the status section until the API provides these fields

## Changes Made

1. **Updated form initialization** to use default values for local form state
2. **Added type mapping** for converting API indexers to domain indexers
3. **Commented out status display section** that relies on non-existent API fields
4. **Used type assertions** to handle the optional categories property

## Date: January 2025
