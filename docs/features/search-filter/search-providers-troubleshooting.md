# Search Providers Troubleshooting

## Issue: No Results in Add Manga Search

If you're experiencing an issue where the Add Manga popup in the library page isn't finding any results despite search service API keys being enabled, this document will help you resolve the issue.

## Root Cause

The problem occurs because the search providers are not properly enabled in the database settings. Specifically:

1. The application uses a `metadata` field in the `Settings` table to store provider configurations
2. When this field is empty or doesn't contain the correct structure, the search function can't determine which providers to use
3. Even if API keys are configured correctly, the providers won't be used for search without the proper settings

## Solution

We've created a script that fixes the search provider settings in the database. This script:

1. Sets up all available search providers (AniList, MangaDex, ComicVine, Fandom)
2. Enables them in the database settings
3. Sets AniList Native as the default provider

### Fixing It

Enable the search providers from **Settings → Indexers / Providers** in the app —
toggle on AniList, MangaDex, ComicVine, and Fandom, and set AniList as the default.
These settings are stored in the database (`Config`), so no script is required.

### Verifying the Fix

After running the script:

1. Restart the application server
2. Navigate to a library page
3. Click the "Add Manga" card
4. Try searching for a manga title (e.g., "One Piece" or "Naruto")
5. You should now see search results from various providers

## Manual Fix

If the script doesn't work for some reason, you can manually fix the issue by executing the following SQL:

```sql
UPDATE "Settings" 
SET metadata = '{"defaultProvider":"anilist-native","providers":{"anilist-native":{"enabled":true},"anilist":{"enabled":true},"mangadex":{"enabled":true},"comicvine":{"enabled":true},"fandom":{"enabled":true}}}'
WHERE id = 1;
```

## Understanding Search Providers

The application supports multiple search providers:

1. **AniList Native** - Primary source for anime/manga metadata
2. **MangaDex** - Comprehensive manga database
3. **ComicVine** - Source for comic book metadata
4. **Fandom** - Wiki-based source for various media
5. **AniList** (Legacy) - Original AniList implementation

Each provider has different strengths and coverage, so enabling all of them provides the best search experience.

## Additional Troubleshooting

If you're still experiencing issues after applying the fix:

1. **Check Console Logs**: Look for any errors related to search providers or API calls
2. **Verify API Keys**: Some providers (like ComicVine) require API keys to be set in the settings
3. **Check Network Connectivity**: Ensure your server can reach the provider APIs
4. **Inspect Provider Status**: Go to Settings > Metadata to check if providers show as enabled

## Provider-Specific Issues

### AniList

- Requires network connectivity but no API key
- Default fallback provider if others fail

### MangaDex

- May require authentication for some operations
- Better for manga than manhwa or manhua

### ComicVine

- Requires an API key to be set in settings
- Best for western comics

### Fandom

- No API key required
- Less structured data than dedicated manga databases