# Enhanced Chapter Titles

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Enhanced Chapter Titles

---
# Enhanced Chapter Titles

This document explains the implementation of enhanced chapter titles for manga that are sourced from AniList.

## Background

AniList's API provides metadata about manga, including the total number of volumes and chapters, but it does not provide individual chapter titles. When a manga is added from AniList, the system generates placeholder chapters with generic titles like "Chapter 1", "Chapter 2", etc.

## Implementation

The enhancement adds more descriptive chapter titles for placeholder chapters generated from AniList metadata. This makes the chapter list more informative and user-friendly.

### Changes Made

1. Modified the `generatePlaceholderChapters` function in `src/components/volumeChaptersTable.tsx` to:
   - Accept the manga title as an optional parameter
   - Generate more descriptive chapter titles based on common manga chapter naming patterns
   - Include volume information in chapter titles for multi-volume manga
   - Add special designations for milestone chapters and volume finales

2. Updated the `VolumeGroupedChaptersProps` interface to include the `title` property in the manga object.

3. Modified the `volumes` useMemo hook to pass the manga title to the `generatePlaceholderChapters` function.

### Enhanced Title Patterns

The following patterns are used to generate enhanced chapter titles:

1. **Volume Information**: For multi-volume manga, chapter titles include the volume number (e.g., "Vol.1 Chapter 5").

2. **First Chapter**: The first chapter of a manga is often an introduction or pilot, so it gets the designation "Introduction" (e.g., "Chapter 1: Introduction").

3. **Milestone Chapters**: Chapters that are multiples of 50 or 100 get special designations:
   - Every 50th chapter: "Milestone" (e.g., "Chapter 50: Milestone")
   - Every 100th chapter: "Major Milestone" (e.g., "Chapter 100: Major Milestone")

4. **Volume Finales**: The last chapter in each volume gets the designation "Volume X Finale" (e.g., "Chapter 10: Volume 1 Finale").

## Testing

A test script is provided to verify the enhanced chapter titles:

```bash
node scripts/test-enhanced-chapter-titles.mjs
```

This script simulates the `generatePlaceholderChapters` function and logs the generated chapter titles for various test cases.

## Examples

### Single Volume Manga (No Title)
- Chapter 1
- Chapter 2
- Chapter 3

### Multi-Volume Manga (No Title)
- Vol.1 Chapter 1
- Vol.1 Chapter 2
- Vol.2 Chapter 3
- Vol.2 Chapter 4

### Single Volume Manga (With Title)
- Chapter 1: Introduction
- Chapter 2
- Chapter 3
- Chapter 4
- Chapter 5: Volume 1 Finale

### Multi-Volume Manga (With Title)
- Vol.1 Chapter 1: Introduction
- Vol.1 Chapter 2
- Vol.1 Chapter 5: Volume 1 Finale
- Vol.2 Chapter 6
- Vol.2 Chapter 10: Volume 2 Finale

### Milestone Chapters
- Chapter 50: Milestone
- Chapter 100: Major Milestone

## Limitations

- The enhanced titles are only applied to placeholder chapters generated from AniList metadata.
- The titles are generated based on common patterns and may not match the actual chapter titles in the manga.
- For manga with actual chapter data (e.g., from local files), the original chapter titles are used.
