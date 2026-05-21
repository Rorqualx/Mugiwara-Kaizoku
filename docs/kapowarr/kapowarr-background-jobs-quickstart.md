# Kapowarr Background Jobs Quickstart

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Background Jobs Quickstart

---
# Kapowarr Background Jobs - Quick Start Guide

## Prerequisites

1. Ensure your database is up to date:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

2. Start the queue processor (if not already running):
   - The queue processor should be started as part of your application startup
   - Check that `queueManager.processTasks()` is being called

## Using Kapowarr with Background Jobs

### 1. Create a Kapowarr Source

```typescript
// Via tRPC
const source = await trpc.kapowarr.createSource.mutate({
  name: 'My Manga Site',
  baseUrl: 'https://example-manga.com',
  config: {
    searchUrl: '/search?q={{query}}',
    selectors: {
      searchResults: {
        container: '.search-results',
        title: { css: '.title', extract: 'text' },
        url: { css: 'a', extract: 'attribute', attribute: 'href' }
        // ... other selectors
      }
    }
  }
});
```

### 2. Validate the Source (Background Job)

```typescript
// This queues a validation task
await trpc.kapowarr.validateSource.mutate({
  sourceId: source.id,
  testQuery: 'One Piece' // Optional test search
});

// The validation runs in the background
// Check source status later:
const updatedSource = await trpc.kapowarr.getSource.query({ id: source.id });
console.log(updatedSource.status); // 'ACTIVE' if successful, 'ERROR' if failed
```

### 3. Search for Manga

```typescript
const results = await trpc.kapowarr.search.query({
  query: 'One Piece',
  sourceIds: [source.id], // Optional: limit to specific sources
  limit: 20
});
```

### 4. Queue a Chapter Download

```typescript
// Create a download record
const download = await trpc.kapowarr.createDownload.mutate({
  sourceId: source.id,
  mangaId: 1, // Your manga ID
  chapterId: 'ch-123', // External chapter ID from source
  chapterNumber: 42
});

// The download is automatically queued as a background task
// Monitor progress:
const activeDownloads = await trpc.kapowarr.getActiveDownloads.query();
```

### 5. Monitor Background Tasks

```typescript
// Check queue statistics
const stats = await queueManager.getQueueStats();
console.log(stats);
// Output: { pending: 2, inProgress: 1, completed: 10, failed: 0 }

// View specific download status
const download = await trpc.kapowarr.getDownload.query({ id: downloadId });
console.log(download.status); // 'QUEUED', 'DOWNLOADING', 'COMPLETED', 'FAILED'
console.log(download.progress); // 0-100
```

### 6. Sync All Sources (Background Job)

```typescript
// Queue a full sync for a source
await trpc.kapowarr.syncSource.mutate({
  sourceId: source.id,
  fullSync: true
});
```

## Monitoring & Troubleshooting

### Check Task Status
```sql
-- View all Kapowarr tasks
SELECT * FROM "Task" 
WHERE type IN ('KAPOWARR_DOWNLOAD', 'KAPOWARR_SOURCE_SYNC', 'KAPOWARR_VALIDATE_SOURCE')
ORDER BY "createdAt" DESC;

-- View active downloads
SELECT * FROM "KapowarrDownload" 
WHERE status IN ('QUEUED', 'DOWNLOADING');
```

### Common Issues

1. **Tasks not processing**: Ensure queue processor is running
2. **Downloads stuck in QUEUED**: Check if source is ACTIVE
3. **Validation failures**: Check network connectivity and selector configuration

### Logs

Monitor application logs for Kapowarr-related messages:
- `Queued Kapowarr download task...`
- `Starting Kapowarr download task...`
- `Kapowarr source validation completed...`

## Development Tips

1. **Test Mode**: Set download progress simulation in KapowarrManager for testing
2. **Debug Selectors**: Use the WebsiteInspector component to test selectors
3. **Queue Priority**: Kapowarr tasks use default priority (0)

## Next Steps

- Configure actual download integration (replace simulation in `downloadChapter`)
- Set up monitoring dashboards for download progress
- Implement retry strategies for failed downloads
- Add download speed limiting and concurrent download controls
