# Blocklist Migration Guide

## Overview
This guide explains how to migrate from the old content-based blocklist system to the new release-based blocklist system.

## Key Differences

### Old System (Content Blocklist)
- Blocks entire manga titles
- Blocks all chapters of a manga
- Blocks sources globally
- No automatic alternatives
- No quality tracking

### New System (Release Blocklist)
- Blocks specific file releases
- Allows other releases of same content
- Pattern-based blocking
- Automatic alternative search
- Quality-based auto-blocking

## Migration Steps

### 1. Database Migration

Run the following migration to create new tables while preserving old data:

```sql
-- Create new tables (handled by Prisma migration)
-- This will be generated when running: bun run db:push

-- Migrate existing blocklist data to new format
INSERT INTO "ReleaseBlocklist" (
  "releaseTitle",
  "mangaId",
  "chapterNumber",
  "reason",
  "reasonDetails",
  "dateAdded",
  "addedBy",
  "expiryDate",
  "isActive",
  "autoBlocked",
  "blockPattern"
)
SELECT 
  COALESCE(
    CONCAT(b."mangaTitle", ' - Chapter ', b."chapterNumber"),
    b."mangaTitle",
    CONCAT('Source: ', b."source"),
    'Unknown'
  ) as "releaseTitle",
  b."mangaId",
  b."chapterNumber",
  CASE 
    WHEN b."reason" = 'QUALITY' THEN 'QUALITY_POOR'
    WHEN b."reason" = 'LANGUAGE' THEN 'WRONG_LANGUAGE'
    WHEN b."reason" = 'SOURCE' THEN 'RELEASE_GROUP'
    WHEN b."reason" = 'DMCA' THEN 'DMCA'
    WHEN b."reason" = 'MANUAL' THEN 'USER_PREFERENCE'
    ELSE 'OTHER'
  END as "reason",
  CONCAT('Migrated from old blocklist: ', b."reasonDetails") as "reasonDetails",
  b."dateAdded",
  b."addedBy",
  b."expiryDate",
  b."isActive",
  false as "autoBlocked",
  CASE
    WHEN b."mangaTitle" IS NOT NULL AND b."chapterNumber" IS NULL 
      THEN CONCAT('.*', REGEXP_REPLACE(b."mangaTitle", '[^a-zA-Z0-9]', '.?'), '.*')
    WHEN b."source" IS NOT NULL 
      THEN CONCAT('.*\\[', b."source", '\\].*')
    ELSE NULL
  END as "blockPattern"
FROM "Blocklist" b
WHERE b."isActive" = true;
```

### 2. Update Environment Variables

No new environment variables required for the new system.

### 3. Update API Endpoints

The old endpoints will be deprecated but remain functional during transition:

#### Deprecated Endpoints
- `POST /api/wanted/blocklist/add` → Use `POST /api/release-blocklist/block`
- `GET /api/wanted/blocklist` → Use `GET /api/release-blocklist/search`
- `DELETE /api/wanted/blocklist/:id` → Use `DELETE /api/release-blocklist/:id`

#### New Endpoints
- `POST /api/release-blocklist/block` - Block a release
- `POST /api/release-blocklist/check` - Check if release is blocked
- `GET /api/release-blocklist/search` - Search blocklist
- `GET /api/release-blocklist/statistics` - Get blocklist stats
- `DELETE /api/release-blocklist/:id` - Remove block

### 4. Update Frontend Routes

Replace old blocklist page with new release blocklist UI:

```typescript
// Old route
/wanted/blocklist

// New route
/settings/release-blocklist
```

### 5. Integration Points

Update the following services to use the new blocklist:

#### Download Manager
```typescript
// Before processing download
const blockCheck = await releaseBlocklistService.checkRelease({
  releaseTitle: release.title,
  releaseHash: release.hash,
  mangaId: manga.id,
  chapterNumber: chapter.number
});

if (blockCheck.isBlocked) {
  // Find alternatives
  const alternatives = blockCheck.alternatives;
  if (alternatives.length > 0) {
    // Try alternative release
    release = alternatives[0];
  } else {
    throw new Error(`Release blocked: ${blockCheck.reason}`);
  }
}
```

#### Search Results
```typescript
// Filter search results
const results = await searchService.search(query);
const filteredResults = [];

for (const result of results) {
  const blockCheck = await releaseBlocklistService.checkRelease({
    releaseTitle: result.title,
    indexerId: result.indexerId
  });
  
  if (!blockCheck.isBlocked) {
    filteredResults.push(result);
  }
}
```

### 6. Quality Tracking

Enable automatic quality-based blocking:

```typescript
// After download attempt
await releaseBlocklistService.recordDownloadAttempt(
  {
    releaseTitle: release.title,
    releaseHash: release.hash,
    mangaId: manga.id,
    chapterNumber: chapter.number
  },
  success,
  errorReason,
  {
    fileSize: BigInt(fileSize),
    downloadTime: elapsedSeconds,
    errorCount: errors.length
  }
);
```

## Rollback Plan

If issues arise, you can rollback by:

1. Restoring the old blocklist table from backup
2. Switching back to old API endpoints
3. Reverting frontend to old blocklist page

Keep the old system running in parallel during transition.

## Timeline

- **Week 1**: Deploy new tables and service
- **Week 2**: Update download manager integration
- **Week 3**: Migrate frontend and user training
- **Week 4**: Deprecate old system

## Common Migration Issues

### Issue: Old patterns too broad
**Solution**: Review migrated patterns and refine them to be more specific

### Issue: Missing alternatives
**Solution**: The system will learn alternatives over time as users download

### Issue: Performance concerns
**Solution**: Ensure proper indexes are created on releaseTitle and releaseHash

## User Communication

Notify users about:
1. New blocking behavior (releases, not content)
2. Automatic alternative search
3. Quality-based auto-blocking
4. New UI location

## Support

For migration issues:
1. Check logs for migration errors
2. Verify all indexes are created
3. Test with a few manual blocks first
4. Monitor download success rates