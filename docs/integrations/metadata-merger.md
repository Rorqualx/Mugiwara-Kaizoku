# Metadata Merger

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Merger

---
# Metadata Merger Service

The Metadata Merger Service is a component of the Kaizoku manga management system that enriches manga metadata by combining information from multiple providers. This service addresses the issue where manga details may be incomplete or missing when using a single metadata provider.

## Overview

When a manga is added to the library or viewed in the detail page, the Metadata Merger Service automatically checks if the metadata needs enrichment. If it does, the service will:

1. Query all available providers (ComicVine, AniList, MangaDex) for metadata about the manga
2. Merge the metadata from all providers, prioritizing the most complete and accurate information
3. Update the manga's metadata in the database with the enriched information

## Key Features

- **Cross-Provider Metadata Enrichment**: Combines metadata from multiple sources to create a more complete profile for each manga
- **Automatic Metadata Repair**: Validates and repairs metadata to ensure it has valid volume and chapter counts
- **Smart Provider Matching**: Uses string similarity algorithms to find the same manga across different providers
- **Seamless Integration**: Works automatically when viewing manga details or can be triggered manually via the refresh metadata button

## Implementation Details

The service consists of three main components:

1. **Metadata Merger Service**: The main service that orchestrates the metadata enrichment process
2. **Provider Matcher**: A utility that finds matching manga across different providers using string similarity algorithms
3. **Metadata Validator**: A utility that validates and repairs metadata to ensure it has valid volume and chapter counts

### How It Works

1. When a manga is viewed in the detail page, the system checks if its metadata needs enrichment
2. If enrichment is needed, the service attempts to find the same manga on other providers
3. For each provider match found, the service retrieves detailed metadata
4. The service then merges the metadata from all providers, prioritizing the most complete information
5. Finally, the service updates the manga's metadata in the database

### Benefits

- **More Complete Metadata**: By combining information from multiple sources, the service can provide a more complete profile for each manga
- **Better User Experience**: Users see more detailed information about their manga, including cover art, descriptions, genres, and chapter/volume counts
- **Reduced Manual Intervention**: The system automatically enriches metadata, reducing the need for manual updates

## Usage

The Metadata Merger Service is used in three main ways:

1. **Automatic Enrichment**: When viewing a manga in the detail page, the system automatically checks if metadata needs enrichment
2. **Manual Refresh**: Users can manually trigger metadata enrichment by clicking the refresh metadata button
3. **New Manga Addition**: When a new manga is added to the library, its metadata is automatically enriched

## Testing

A test script is provided to verify the functionality of the Metadata Merger Service:

```bash
node scripts/test-metadata-merger.js
```

This script will:
1. Find a manga in the database
2. Display its current metadata
3. Attempt to enrich its metadata
4. Display the updated metadata if enrichment was successful
