# Missing Items Detection Improvements

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Missing Items Detection Improvements

---
/**
 * Missing Items Detection Improvements
 * 
 * This document outlines the improvements made to the missing items detection
 * functionality in the wanted pages implementation.
 */

## Problem
The original implementation had several issues:
1. Metadata was not properly included in the query
2. The code attempted to access `manga.metadata` without ensuring it was loaded
3. Chapter number detection was based on parsing filenames which is unreliable

## Solution Implemented

### 1. Fixed Metadata Inclusion
```typescript
// Now properly includes metadata in the query
const monitoredManga = await prisma.manga.findMany({
  where: {
    status: {
      notIn: ['COMPLETED', 'DELETED', 'ERROR']
    }
  },
  include: {
    chapters: {
      orderBy: {
        index: 'asc'
      }
    },
    metadata: true // Include metadata relation directly
  }
});
```

### 2. Proper Null Checking
```typescript
// Skip if no metadata or no expected chapter count
if (!manga.metadata?.chapters || manga.metadata.chapters === 0) {
  continue;
}
```

### 3. Use Chapter Index Instead of Parsing Filenames
The Chapter model has an `index` field that represents the chapter number:
```typescript
const existingChapterIndices = manga.chapters
  .map(ch => ch.index)
  .filter(index => index !== null && index !== undefined)
  .sort((a, b) => a - b);
```

## Alternative Approaches for Missing Chapter Detection

### 1. Gap Detection (Without Metadata)
For manga without metadata specifying expected chapters, we can detect gaps:

```typescript
function detectChapterGaps(chapters: Chapter[]): number[] {
  const indices = chapters
    .map(ch => ch.index)
    .filter(idx => idx !== null && idx !== undefined)
    .sort((a, b) => a - b);
  
  if (indices.length === 0) return [];
  
  const gaps: number[] = [];
  for (let i = 1; i < indices.length; i++) {
    const current = indices[i];
    const previous = indices[i - 1];
    
    // Check for gaps
    for (let j = previous + 1; j < current; j++) {
      gaps.push(j);
    }
  }
  
  return gaps;
}
```

### 2. Smart Detection Based on Patterns
Detect patterns in chapter releases:

```typescript
function detectMissingByPattern(chapters: Chapter[]): number[] {
  // Get recent chapters to establish pattern
  const recentChapters = chapters
    .sort((a, b) => b.index - a.index)
    .slice(0, 10);
  
  // Detect release pattern (weekly, bi-weekly, etc.)
  // Implementation would analyze time between releases
  // and indices to predict missing chapters
}
```

### 3. Provider-Based Detection
Query metadata providers to get expected chapter list:

```typescript
async function detectMissingFromProvider(
  manga: Manga, 
  provider: string
): Promise<number[]> {
  // Query the provider API for chapter list
  // Compare with local chapters
  // Return missing chapter numbers
}
```

## Current Implementation Notes

1. **Monitored Field**: The code mentions adding a `monitored` field to the Manga model. This would allow users to control which manga to check for missing chapters.

2. **Performance Considerations**: The current implementation loads all chapters for all active manga. For large libraries, consider:
   - Pagination
   - Background processing
   - Caching results
   - Only checking recently updated manga

3. **Chapter Numbering**: The implementation assumes sequential integer chapter numbers (1, 2, 3...). Some manga have:
   - Decimal chapters (12.5)
   - Special chapters (0, -1)
   - Non-numeric identifiers

## Recommendations

1. **Add Monitored Field**: Add a `monitored` boolean to the Manga model to allow selective monitoring.

2. **Implement Gap Detection**: Use gap detection as a fallback when metadata is unavailable.

3. **Add Manual Chapter Count**: Allow users to manually set expected chapter count when metadata is wrong or missing.

4. **Background Processing**: Move missing item detection to a background job that runs periodically.

5. **Flexible Chapter Numbering**: Support decimal and special chapter numbers.

Example schema addition:
```prisma
model Manga {
  // ... existing fields
  monitored        Boolean   @default(true)    // Whether to monitor for missing chapters
  expectedChapters Int?                       // Manual override for expected chapters
  lastMissingCheck DateTime?                  // Last time missing items were checked
}
```