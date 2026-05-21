# Integration Status

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Integration Status

---
# Integration Status

This document provides an overview of the current status of various integrations in Kaizoku.

## Core Integrations

| Integration | Status | Description |
|-------------|--------|-------------|
| [Mangal](https://github.com/metafates/mangal) | ✅ Enabled | Primary manga downloader used by Kaizoku |
| [Suwayomi](./suwayomi-setup.md) | ✅ Enabled | Manga reading and source management |
| [Prowlarr](../README.md#prowlarr-integration) | ✅ Enabled | Enhanced manga searching and indexing |

## Metadata Providers

| Provider | Status | Documentation |
|----------|--------|---------------|
| [AniList](./anilist-native-guide.md) | ✅ Enabled | Anime and manga metadata provider with optional authentication |
| [MangaDex](./mangadex-integration.md) | ✅ Enabled | Manga metadata and chapter information |
| [ComicVine](./comicvine-integration.md) | ✅ Enabled | Western comics metadata provider |
| [Fandom](./fandom-integration.md) | ✅ Enabled | Wiki-based metadata for various manga series |

## Integration Features

| Feature | Related Integrations | Documentation |
|---------|----------------------|---------------|
| Cross-Provider Metadata Enrichment | All metadata providers | [Metadata Merger](./metadata-merger.md) |
| Multi-Provider Search | All metadata providers | [Multi-Provider Search](./multi-provider-search.md) |
| Enhanced Chapter Titles | MangaDex, AniList | [Enhanced Chapter Titles](./enhanced-chapter-titles.md) |

## Note on Integration Status

The enabled status of integrations is determined by the database configuration and user settings. The previous issues documented with ComicVine integration have been resolved in recent updates. Integration status is now properly managed through the database and settings interface.

## General Troubleshooting

For integration-specific troubleshooting, please refer to:

- [AniList Integration Troubleshooting](./anilist-integration-troubleshooting.md)
- [Fix Manga Not Found Error](./fix-manga-not-found-error.md)

## Adding New Integrations

If you're interested in adding support for additional manga sources or metadata providers, please check our [Contributing Guidelines](../CONTRIBUTING.md) for information on how to get started.
