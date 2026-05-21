# INTEGRATION_STATUS_FIX

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for INTEGRATION_STATUS_FIX

---
# Integration Status Display Fix - Final Solution

## Issue
The system status page shows ComicVine and AniList as disabled even when they are actually enabled.

## Root Cause
The application uses multiple storage methods for metadata provider settings:

1. **Traditional settings table**: `settings.metadata` field (JSON)
2. **New ConfigService**: Individual entries in a `Config` table
3. **Multiple formats**: Even within the settings table, there are old and new formats

## Solution Applied - Comprehensive Fix

Updated the system router (`/src/server/trpc/router/system.ts`) to handle all possible storage scenarios:

### 1. Check settings.metadata (new format)
```json
{
  "providers": {
    "anilist": { "enabled": true, "settings": {} },
    "comicvine": { "enabled": true, "settings": {} }
  }
}
```

### 2. Check settings.metadata (old format)
```json
{
  "anilist": { "enabled": true, "settings": {} },
  "comicvine": { "enabled": true, "settings": {} }
}
```

### 3. Check Config table (if exists)
Individual entries like:
- `metadata` = full metadata JSON
- `metadataProviders.providers.anilist.enabled` = "true"
- `metadataProviders.providers.comicvine.enabled` = "true"

## Implementation Details

The fix includes:

1. **Multi-source checking**: Checks settings table first, then Config table if needed
2. **Format detection**: Automatically detects old vs new metadata formats
3. **Safe querying**: Checks if Config table exists before querying
4. **Comprehensive logging**: Detailed debug logs to identify storage location
5. **Fallback support**: Works even if some storage methods fail

## How to Apply

1. **Rebuild the application**:
   ```bash
   pnpm build:clean
   ```

2. **Restart the application**

3. **Check the logs** for one of these messages:
   - "System status metadata structure" - shows metadata from settings table
   - "Found providers at top level (old format)" - detected old format
   - "Reconstructed metadata from Config table" - using Config table
   - "Config table does not exist" - only using settings table

4. **Verify** on the system status page that integrations show correctly

## Troubleshooting

If integrations still show as disabled:

1. **Check the logs** to see which storage method is being used
2. **Run the migration** by clicking "Fix Providers" button
3. **Update settings** through the UI metadata settings page
4. **Check database directly**:

   ```sql
   -- Check settings table
   SELECT metadata FROM settings LIMIT 1;
   
   -- Check if Config table exists and has entries
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'Config';
   
   -- If Config table exists, check entries
   SELECT key, value FROM "Config" 
   WHERE key LIKE 'metadata%' OR key LIKE 'metadataProviders%';
   ```

## Why This Works

The solution is resilient because it:
- Doesn't assume any particular storage method
- Checks multiple locations in order of preference
- Handles missing tables gracefully
- Supports all historical formats
- Provides detailed logging for debugging

This ensures the system status page will correctly display integration status regardless of how the application stores its configuration.
