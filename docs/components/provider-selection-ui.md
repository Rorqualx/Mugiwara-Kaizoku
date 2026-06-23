# Provider Selection UI

This document describes the Provider Selection UI feature, which allows users to choose which metadata provider to use for specific fields in a manga's metadata.

## Overview

The Kaizoku app gathers metadata from multiple providers (Anilist, ComicVine, MangaDex, Fandom) when adding manga to the library. Each provider may have different information for the same manga, and sometimes one provider might have more accurate information for certain fields than others.

The Provider Selection UI allows users to:

1. See which provider was used for each metadata field
2. Select a different provider for specific fields
3. Save these preferences for future metadata refreshes

## How It Works

### Metadata Provenance Tracking

When metadata is gathered from different providers, the system tracks which provider supplied each field in a `metadataProvenance` object stored in the manga's `providerMetadata` JSON field. For example:

```json
{
  "metadataProvenance": {
    "title": "anilist-native",
    "summary": "anilist-native",
    "status": "anilist-native",
    "genres": "anilist-native",
    "volumes": "fandom",
    "chapters": "fandom"
  }
}
```

### User Preferences

When a user selects a different provider for a field, these preferences are stored in a `preferences` object within the manga's `providerMetadata`:

```json
{
  "preferences": {
    "summary": {
      "provider": "fandom",
      "value": "A more detailed summary from Fandom..."
    },
    "volumes": {
      "provider": "comicvine",
      "value": 42
    }
  }
}
```

### Metadata Enrichment

When metadata is refreshed, the `metadataMergerService` respects these preferences by:

1. Checking if there's a user preference for each field
2. If a preference exists, using the specified provider's data for that field
3. Otherwise, following the default merging logic

## User Interface

The Provider Selection UI is integrated into the manga update modal as a new tab:

1. Users can access it by clicking the edit icon on a manga's detail page
2. The UI shows each metadata field, its current value, and which provider it came from
3. For each field, users can select a different provider from a dropdown
4. Changes are saved and applied when the user clicks "Save Preferences"

## Technical Implementation

The feature consists of:

1. **Backend Components**:
   - A new `updateProviderPreferences` procedure in the manga router
   - Enhanced `enhanceMetadata` method in the metadata merger service

2. **Frontend Components**:
   - `ProviderSelectionForm.tsx` - The main UI component
   - Integration with the existing update manga modal

## Default Provider Priorities

If no user preferences are specified, the system uses the following default priorities:

- **Fandom** is prioritized for volume and chapter counts
- **Anilist** is generally preferred for basic metadata (title, summary, genres)
- **ComicVine** is used for Western comics metadata
- **MangaDex** provides additional chapter information

## Future Enhancements

Potential future enhancements to this feature:

1. Preview of values from different providers before selection
2. Bulk selection options (e.g., "Use Anilist for all fields")
3. Default provider preferences at the application level
4. Support for additional metadata providers
