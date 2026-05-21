# Fix Search With Comicvine

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Search With Comicvine

---
# Fixing Search When Switching Metadata Providers

## Issue

When switching metadata providers from AnilistNative to ComicVine, the search functionality stopped working. This was due to the AniList integration being disabled in the app settings, which prevented the cover art from being retrieved properly.

## Root Cause

The issue was caused by two main factors:

1. The AniList integration was disabled in the app settings (`anilistEnabled` was set to `false`)
2. Even though the AniList-native provider was being used for search, the cover art wasn't being retrieved properly because the AniList integration was disabled

## Solution

The solution involved enabling the AniList integration and configuring it to use the native provider:

1. Enable the AniList integration (`anilistEnabled` set to `true`)
2. Enable using AniList for metadata (`anilistUseForMetadata` set to `true`)
3. Configure the metadata settings to use the native provider:
   - `metadata.defaultProvider` set to `anilist-native`
   - `metadata.anilistUseNativeProvider` set to `true`
   - `metadata.anilist.settings.useNativeProvider` set to `true`

## Implementation

We created several scripts to fix the issue:

1. `scripts/enable-anilist-integration.js`: Enables the AniList integration and configures it to use the native provider
2. `scripts/update-manga-cover.js`: Updates the cover art for a manga in the database
3. `scripts/update-manga-title.js`: Updates the title of a manga in the database
4. `scripts/check-manga-metadata.js`: Displays the metadata for a manga in the database
5. `scripts/list-manga-titles.js`: Lists all manga titles in the database

### Running the Fix

To fix the issue, run the following commands:

```bash
# Enable AniList integration
node scripts/enable-anilist-integration.js

# Update manga cover art (for manga with ID 6)
node scripts/update-manga-cover.js 6

# Update manga title (for manga with ID 6)
node scripts/update-manga-title.js 6 "One Piece"

# Check manga metadata (for manga with ID 6)
node scripts/check-manga-metadata.js 6
```

## Verification

After running the fix, the manga should have the correct title and cover art. You can verify this by checking the metadata:

```bash
node scripts/check-manga-metadata.js 6
```

The output should show:
- Title: "One Piece"
- Cover art URLs pointing to the AniList CDN (e.g., `https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhEK1TE.jpg`)

## Future Considerations

When switching metadata providers, ensure that the corresponding integration is enabled in the app settings. This is especially important when using the AniList-native provider, which requires the AniList integration to be enabled.
