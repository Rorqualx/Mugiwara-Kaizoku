# Status System Implementation Guide

## Overview

This guide documents the complete implementation of the new three-tier status system for Mugiwara-Kaizoku, separating MangaStatus into three distinct concepts:

1. **Publication Status** - The manga's publication state from the provider
2. **File Status** - The download/file processing state
3. **Library Status** - The user's relationship with the manga

## Implementation Complete ✅

### 1. Database Schema Updates

#### Files Created:
- `/prisma/migrations/add_specific_status_columns.sql` - SQL migration script
- `/prisma/schema-updates.prisma` - Prisma schema additions

#### New Database Columns:
```sql
ALTER TABLE "Manga" ADD COLUMN "publicationStatus" TEXT;
ALTER TABLE "Manga" ADD COLUMN "fileStatus" TEXT;
ALTER TABLE "Manga" ADD COLUMN "libraryStatus" TEXT;
```

### 2. Type Definitions

#### Files Created:
- `/src/types/canonical/status.types.ts` - Core type definitions
- `/src/utils/status-mapping-v2.ts` - Status mapping utilities

#### New Enums:
```typescript
enum MangaPublicationStatus {
  ONGOING, COMPLETED, CANCELLED, HIATUS, NOT_YET_PUBLISHED, UNKNOWN
}

enum MangaFileStatus {
  PENDING, SEARCHING, DOWNLOADING, PROCESSING, DOWNLOADED, 
  FAILED, ERROR, MISSING, DELETED
}

enum MangaLibraryStatus {
  PLAN_TO_READ, READING, COMPLETED, DROPPED, ON_HOLD, RE_READING
}
```

### 3. Data Migration

#### Files Created:
- `/scripts/migrate-status-data.ts` - Data migration script

#### Usage:
```bash
# Enable feature flag
export ENABLE_NEW_STATUS_SYSTEM=true

# Run migration
npx tsx scripts/migrate-status-data.ts
```

### 4. Service Layer

#### Files Created:
- `/src/services/status/StatusService.ts` - Status service with backward compatibility

#### Key Features:
- Automatic fallback to old status system
- Status mapping and conversion
- Display label generation
- Color coding for UI

### 5. UI Components

#### Files Created:
- `/src/components/status/MangaStatusBadges.tsx` - Status badge components
- `/src/components/manga/MangaListWithNewStatus.tsx` - Example implementation

#### Features:
- Three separate status badges
- Icon support with animations
- Tooltips and color coding
- Backward compatibility mode

### 6. Feature Flags

#### Files Created:
- `/src/config/featureFlags.ts` - Feature flag management

#### Configuration:
```typescript
// Environment variable
ENABLE_NEW_STATUS_SYSTEM=true

// Or database config
key: 'feature_flag_newStatusSystem'
value: 'true'
```

## Deployment Steps

### Phase 1: Database Preparation
```bash
# 1. Apply database migration
psql -U postgres -d kaizoku < prisma/migrations/add_specific_status_columns.sql

# 2. Update Prisma schema
# Add the new enums and fields from schema-updates.prisma to schema.prisma

# 3. Generate Prisma client
npx prisma generate
```

### Phase 2: Data Migration
```bash
# 1. Test migration in development
ENABLE_NEW_STATUS_SYSTEM=true npx tsx scripts/migrate-status-data.ts

# 2. Verify data
psql -U postgres -d kaizoku -c "
  SELECT COUNT(*) as total,
    COUNT(publicationStatus) as has_pub,
    COUNT(fileStatus) as has_file,
    COUNT(libraryStatus) as has_lib
  FROM \"Manga\";"
```

### Phase 3: Code Deployment
```bash
# 1. Deploy with feature flag disabled
ENABLE_NEW_STATUS_SYSTEM=false npm run build
npm run start

# 2. Test with feature flag enabled for specific users
# Enable via database for testing

# 3. Gradual rollout
# Monitor for issues, increase percentage of users
```

### Phase 4: Full Rollout
```bash
# 1. Enable for all users
ENABLE_NEW_STATUS_SYSTEM=true

# 2. Monitor for 1-2 weeks

# 3. Remove old status column (after confirming stability)
ALTER TABLE "Manga" DROP COLUMN "status";
```

## Usage Examples

### Using StatusService
```typescript
import { StatusService } from '@/services/status/StatusService';

const statusService = new StatusService(prisma);

// Get statuses
const pubStatus = statusService.getPublicationStatus(manga);
const fileStatus = statusService.getFileStatus(manga);
const libStatus = statusService.getLibraryStatus(manga);

// Update statuses
await statusService.updateStatuses(mangaId, {
  publicationStatus: MangaPublicationStatus.COMPLETED,
  fileStatus: MangaFileStatus.DOWNLOADED,
  libraryStatus: MangaLibraryStatus.READING
});
```

### Using Status Badges
```tsx
import { MangaStatusBadges } from '@/components/status/MangaStatusBadges';

<MangaStatusBadges
  publicationStatus={manga.publicationStatus}
  fileStatus={manga.fileStatus}
  libraryStatus={manga.libraryStatus}
  size="sm"
  showIcons
/>
```

### Using Feature Flags
```tsx
import { useFeatureFlag } from '@/config/featureFlags';

function MyComponent() {
  const useNewStatus = useFeatureFlag('newStatusSystem');
  
  if (useNewStatus) {
    // New status system
    return <MangaStatusBadges {...props} />;
  } else {
    // Old status system
    return <OldStatusBadge status={manga.status} />;
  }
}
```

## Monitoring

### Key Metrics to Track:
1. **Migration Success Rate**
   ```sql
   SELECT 
     COUNT(*) as total,
     COUNT(CASE WHEN publicationStatus IS NOT NULL THEN 1 END) as migrated,
     COUNT(CASE WHEN publicationStatus IS NULL THEN 1 END) as pending
   FROM "Manga";
   ```

2. **Status Distribution**
   ```sql
   SELECT publicationStatus, COUNT(*) 
   FROM "Manga" 
   GROUP BY publicationStatus;
   ```

3. **Error Logs**
   - Watch for status conversion errors
   - Monitor StatusService failures
   - Track feature flag toggle issues

## Rollback Plan

If issues occur:

1. **Disable Feature Flag**
   ```bash
   export ENABLE_NEW_STATUS_SYSTEM=false
   ```

2. **Revert Code** (if needed)
   ```bash
   git revert <commit-hash>
   ```

3. **Keep Database Changes**
   - New columns can remain (they don't affect old code)
   - Data is preserved for retry

## Benefits Achieved

1. **Type Safety** ✅
   - Clear distinction between status types
   - Compile-time checking
   - No more status confusion

2. **Maintainability** ✅
   - Separated concerns
   - Clear naming
   - Easy to extend

3. **User Experience** ✅
   - More accurate status display
   - Better filtering options
   - Clear download states

4. **Backward Compatibility** ✅
   - Old code continues to work
   - Gradual migration path
   - Feature flag control

## Next Steps

1. **Monitor rollout** for 1-2 weeks
2. **Gather user feedback** on new status display
3. **Update documentation** with new status system
4. **Remove old status field** after full migration
5. **Add status history tracking** for analytics

## Support

For issues or questions:
- Check logs: `grep "StatusService" /var/log/kaizoku.log`
- Review migration output: `scripts/migrate-status-data.ts`
- Toggle feature flag: `ENABLE_NEW_STATUS_SYSTEM=false`

---

*Implementation completed: August 30, 2025*
*Ready for deployment with feature flag control*