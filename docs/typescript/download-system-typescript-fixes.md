# Download System Typescript Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Download System Typescript Fixes

---
# TypeScript Error Fix Summary - Download System Enhancement

## Error Categories and Fixes Applied

### 1. Missing Files Created
- ✅ `/src/lib/constants.ts` - Created with MANGAL_SUPPORTED_SOURCES
- ✅ `/src/server/db/client.ts` - Re-export of prisma client
- ✅ `/src/server/db/prisma.ts` - Re-export for download manager
- ✅ `/src/api/base/BaseDownloadClient.ts` - Alias for DownloadClient
- ✅ `/src/api/base/HttpClient.ts` - Re-export from utils
- ✅ `/src/utils/id-utils.ts` - ID conversion utilities

### 2. Type Updates Applied
- ✅ ChapterStatus enum - Added COMPLETED and ERROR values with UPPERCASE
- ✅ ChapterFile interface - Added fileSize property (alias for size)
- ✅ ChapterEntity interface - Added progress property
- ✅ AutoDownloadConfig - Added language property

### 3. Remaining Issues to Fix

#### Mantine v7 API Changes
```typescript
// Replace these props:
weight={500} → fw={500}          // Text component
spacing="xs" → gap="xs"          // Group/Stack components
position="apart" → justify="space-between"  // Group component
icon={<Icon />} → leftSection={<Icon />}   // Menu.Item
creatable → // Remove, use getCreateLabel only

// Replace isLoading with isPending
mutation.isLoading → mutation.isPending
```

#### tRPC v10 API Changes
```typescript
// Replace query access pattern
trpc.settings.query.useQuery() → trpc.settings.all.useQuery()
// OR check the actual router structure
```

#### ID Type Conversions
```typescript
// Import the utility
import { idToNumber } from '../../utils/id-utils';

// Convert IDs before passing to tRPC
mangaId: idToNumber(manga.id)
chapterIds: idsToNumbers(chapters.map(ch => ch.id))
```

#### AsyncResult Type Guards
```typescript
// Always check status before accessing properties
import { isSuccess, isError } from '../../utils/async-result';

if (isSuccess(result)) {
  // Access result.data
} else if (isError(result)) {
  // Access result.error
}
```

### 4. Database Migration Required
The Prisma models `Download` and `AutoDownloadRule` need to be added to the database:
```bash
npx prisma generate
npx prisma migrate dev --name add-download-system
```

### 5. Quick Fixes Script
```typescript
// Fix all Mantine v7 issues in a file
// weight → fw
// spacing → gap
// position="apart" → justify="space-between"
// icon → leftSection
```

## Next Steps
1. Run database migrations
2. Apply Mantine v7 prop updates
3. Update tRPC query patterns
4. Add ID conversions where needed
5. Fix AsyncResult property access
6. Test the download system
