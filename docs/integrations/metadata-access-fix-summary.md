# Metadata Access Fix Summary

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Access Fix Summary

---
# Summary: Fixed Metadata Access Issue in Wanted Pages

## Problem
The `getMissingItemsAsync` function was trying to access `manga.metadata?.chapters` but:
1. The metadata relation wasn't properly included in the query
2. There was no fallback when metadata was unavailable

## Solution Implemented

### 1. Fixed Query to Include Metadata
```typescript
const monitoredManga = await prisma.manga.findMany({
  include: {
    chapters: {
      orderBy: { index: 'asc' }
    },
    metadata: true // Now properly included
  }
});
```

### 2. Added Null Checking
The function now properly checks if metadata exists before accessing it:
```typescript
if (manga.metadata?.chapters && manga.metadata.chapters > 0) {
  // Use metadata-based detection
}
```

### 3. Added Gap Detection Fallback
Created a `detectChapterGaps` function that finds missing chapters by detecting gaps in the sequence:
```typescript
function detectChapterGaps(chapters: { index: number }[]): number[] {
  // Detects gaps like: [1, 2, 5, 6] → Missing: [3, 4]
}
```

### 4. Two-Method Approach
The function now uses two methods:
1. **Primary**: If metadata exists with expected chapter count, compare against it
2. **Fallback**: If no metadata, detect gaps in existing chapter sequences

## Next Steps

To generate Prisma client and test the implementation:

```bash
# Generate Prisma client with new schema
pnpm generate

# Start development server
pnpm dev

# Navigate to /wanted/missing to test
```

## Additional Improvements Needed

1. **Add Monitored Field**: Add a `monitored` boolean to Manga model to allow selective monitoring
2. **Support Decimal Chapters**: Handle chapters like 12.5, 0, etc.
3. **Background Processing**: Move detection to a scheduled job for better performance
4. **Manual Override**: Allow users to set expected chapter count manually

The missing items detection is now more robust and will work even without metadata!