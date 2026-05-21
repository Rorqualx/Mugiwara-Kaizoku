# Fix Manga Metadata Issues

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Manga Metadata Issues

---
# Fixing Manga Metadata Issues

This document explains the metadata validation and repair functionality that ensures manga metadata always has valid volume and chapter counts, which is necessary for the chapter table to be generated correctly.

## Problem

The manga detail page was failing to make API calls to metadata providers and return the necessary information to build the chapter table after a manga is added. The chapter table was not being generated automatically as expected.

The root cause of this issue was that some manga had missing or invalid metadata, particularly the `volumes` and `chapters` fields, which are required for the chapter table to be generated correctly.

## Solution

We implemented a metadata validation and repair system that ensures manga metadata always has valid volume and chapter counts. This system consists of:

1. A utility function that validates and repairs manga metadata
2. Integration of this utility into key procedures in the manga router
3. Scripts to test and fix metadata for all manga in the database

### Metadata Validator Utility

The metadata validator utility (`src/server/utils/metadataValidator.ts`) provides functions to validate and repair manga metadata:

- `validateAndRepairMetadata`: Validates and repairs manga metadata to ensure it has valid volume and chapter counts
- `needsMetadataRepair`: Checks if metadata needs repair (missing or invalid volume/chapter counts)

### Integration into Manga Router

The metadata validator utility is integrated into key procedures in the manga router (`src/server/trpc/routers/manga.ts`):

- `get`: Checks if metadata needs repair and attempts to refresh it if necessary
- `add`: Validates and repairs metadata when adding a new manga
- `refreshMetadata`: Validates and repairs metadata when refreshing manga metadata

### Scripts

Two scripts are provided to test and fix metadata for all manga in the database:

- `scripts/test-metadata-validator.js`: Tests the metadata validator utility
- `scripts/fix-manga-metadata.js`: Fixes all manga metadata in the database

## Usage

### Running the Fix Script

To fix all manga metadata in the database, run:

```bash
node scripts/fix-manga-metadata.js
```

This script will:
1. Check all manga in the database
2. Create default metadata for manga without metadata
3. Fix metadata with invalid volume or chapter counts
4. Report the number of manga fixed

### Automatic Validation

The system automatically validates and repairs metadata in the following cases:

- When fetching a manga (via the `get` procedure)
- When adding a new manga (via the `add` procedure)
- When refreshing manga metadata (via the `refreshMetadata` procedure)

## Default Values

When repairing metadata, the following default values are used:

- `volumes`: 1 (if missing or invalid)
- `chapters`: 1 (if missing or invalid)

For manga without metadata, a default metadata record is created with:

- `volumes`: 1
- `chapters`: 1
- `summary`: '' (empty string)
- `genres`: [] (empty array)
- `status`: 'UNKNOWN'
- `coverLarge`: '/cover-not-found.jpg'
- `coverMedium`: '/cover-not-found.jpg'
- `coverSmall`: '/cover-not-found.jpg'

## Source-Specific Handling

The system includes special handling for different metadata sources:

- **ComicVine**: Uses `count_of_issues` as chapters if available
- **AniList**: Uses the volumes and chapters fields directly
- **MangaDex**: Uses the volumes and chapters fields directly

## Logging

The system logs all validation and repair operations, including:

- When metadata is missing or invalid
- When metadata is repaired
- The values before and after repair

This helps with debugging and monitoring the system.
