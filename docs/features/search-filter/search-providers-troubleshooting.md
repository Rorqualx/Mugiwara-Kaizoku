# Search Providers Troubleshooting

## Issue: No Results in Add Manga Search

If you're experiencing an issue where the Add Manga popup in the library page isn't finding any results despite search service API keys being enabled, this document will help you resolve the issue.

## Root Cause

The problem occurs because the search providers are not properly enabled in the database settings. Specifically:

1. The application stores provider configurations as key-value rows in the `Config` table (the legacy `Settings` table was removed)
2. When provider rows are missing or set to disabled, the search function can't determine which providers to use
3. Even if API keys are configured correctly, the providers won't be used for search without the proper settings

## Solution

Enable the search providers from **Settings → Metadata** in the app —
toggle on AniList, MangaDex, ComicVine, Fandom, and Wikipedia as desired, and set AniList as the default.
These settings are stored in the database (`Config`), so no script is required.

### Verifying the Fix

After enabling providers in the UI:

1. Restart the application server
2. Navigate to a library page
3. Click the "Add Manga" card
4. Try searching for a manga title (e.g., "One Piece" or "Naruto")
5. You should now see search results from various providers

## Manual Fix

If the UI toggle doesn't work for some reason, you can manually enable providers by inserting or upserting rows in the `Config` table. The `Settings` table no longer exists — all settings are stored in `Config` as key-value rows. Use the Settings → Metadata page in the application instead of direct SQL where possible.

## Understanding Search Providers

The application supports multiple search providers:

1. **AniList** - Primary source for anime/manga metadata
2. **MangaDex** - Comprehensive manga database
3. **ComicVine** - Source for comic book metadata
4. **Fandom** - Wiki-based source for various media
5. **Wikipedia** - General wiki-based source

Each provider has different strengths and coverage, so enabling the relevant ones provides the best search experience.

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