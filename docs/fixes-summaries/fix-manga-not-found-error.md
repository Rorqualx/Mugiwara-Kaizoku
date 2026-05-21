# Fix Manga Not Found Error

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Manga Not Found Error

---
# Fixing "Manga Not Found" Error

This document explains how to fix the error that occurs when adding manga to your library:

```
Failed to get anilist-native metadata: Failed to get metadata: No manga found for AniList ID
```

## The Problem

When adding manga to your library, the application attempts to fetch metadata from AniList. If the AniList ID doesn't exist or there's an issue with the AniList API, the application would previously fail with an error.

## The Solution

We've implemented a more robust error handling system that:

1. Gracefully handles cases where a manga ID can't be found in AniList
2. Provides fallback mechanisms to search by title when ID lookup fails
3. Creates basic metadata entries even when external providers fail
4. Works without requiring AniList credentials

## How to Fix

### Option 1: Run the Fix Script

We've created a script that automatically applies the necessary fixes:

```bash
node scripts/fix-manga-not-found-fix.js
```

This script will:
- Enable AniList without requiring credentials
- Configure the metadata providers to use the improved error handling
- Verify the settings are correctly configured

### Option 2: Manual Fix

If you prefer to manually fix the issue:

1. Go to Settings > Metadata
2. Enable AniList integration
3. Set AniList as the default metadata provider
4. Restart the application

## Verifying the Fix

After applying the fix:

1. Try adding a manga to your library
2. Even if the exact manga isn't found in AniList, the application will now:
   - Try to search by title
   - Create a basic metadata entry if all else fails
   - Allow you to proceed with adding the manga

## Technical Details

The fix includes the following improvements:

1. Enhanced error handling in the AniList native provider
2. Fallback mechanisms to search by title when ID lookup fails
3. Creation of basic metadata entries when external providers fail
4. Support for using AniList without credentials

These changes ensure that the manga addition process is more robust and user-friendly, even when external metadata providers encounter issues.

## Still Having Issues?

If you're still experiencing problems after applying the fix:

1. Make sure you've restarted the application
2. Check the logs for any specific error messages
3. Try adding manga with a different title or source
4. If all else fails, you can manually enter manga details by using the manual entry option in the add manga form
