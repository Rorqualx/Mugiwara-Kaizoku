# Metadata Providers Structure

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Providers Structure

---
# Metadata Providers Structure

Kaizoku uses a standardized structure for managing metadata providers within the application. This document outlines the correct structure and migration from older formats.

## Current Structure

The metadata providers are stored in a JSON field in the `settings` table with the following structure:

```json
{
  "providers": {
    "anilist": {
      "enabled": true,
      "settings": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    },
    "comicvine": {
      "enabled": true,
      "settings": {
        "apiKey": "your-api-key"
      }
    },
    "anilist-native": {
      "enabled": true,
      "settings": {
        "clientId": "your-client-id"
      }
    }
  },
  "defaultProvider": "anilist"
}
```

## Key Components

1. **providers**: Object containing all provider configurations
   - Each provider has its own key with configuration
   - Provider objects contain:
     - `enabled`: Boolean indicating if the provider is enabled
     - `settings`: Object with provider-specific settings

2. **defaultProvider**: String indicating the default provider to use

## Provider IDs

The system currently supports the following provider IDs:

- `anilist`: Standard AniList provider
- `anilist-native`: Enhanced AniList provider
- `comicvine`: ComicVine provider
- `mangadex`: MangaDex provider 
- `fandom`: Fandom provider

## Using the Provider Structure

To interact with the provider structure, use the utility functions in `src/utils/metadataUtils.ts`:

```typescript
// Get provider settings
const settings = getProviderSettings(metadata, 'comicvine');

// Check if provider is enabled
const enabled = isProviderEnabled(metadata, 'comicvine');

// Update provider settings
const updatedMetadata = updateProviderSettings(
  metadata,
  'comicvine',
  { apiKey: 'new-api-key' },
  { setEnabled: true }
);
```

## Migration from Legacy Structure

In previous versions, provider settings were sometimes stored at the top level of the metadata object:

```json
{
  "comicvine": {
    "enabled": true,
    "settings": {
      "apiKey": "your-api-key"
    }
  }
}
```

We've created a migration script to move these settings to the new structure:

```bash
node scripts/migrateMetadataProviders.js
```

This script checks for top-level provider entries and moves them to the standardized structure under the `providers` object.

## Integration with System Status

The system status checks look for provider settings under the `providers` object. If you're adding a new provider, make sure to follow this structure for proper status detection in the UI.
