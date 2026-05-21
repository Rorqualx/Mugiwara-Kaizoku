# Trpc Unused Endpoints Integration Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Trpc Unused Endpoints Integration Plan

---
# Comprehensive Integration Plan for 59 Unused tRPC Endpoints

## Executive Summary

This document provides a detailed integration plan for all 59 unused tRPC endpoints in the Mugiwara-Kaizoku application. These endpoints were developed in parallel with the frontend but never integrated. The plan includes specific UI locations, implementation priorities, and code examples for each endpoint.

## Integration Categories

### 1. Search System Integration (5 endpoints)
**Priority: HIGH** - Core functionality that enhances user experience

#### 1.1 `search.withProvider`
**Location**: `/src/components/search/SearchForm.tsx`
**Current State**: Uses direct provider search through hooks
**Integration**:
```typescript
// Replace current direct provider search with tRPC endpoint
const searchMutation = trpc.search.withProvider.useMutation({
  onSuccess: (results) => {
    setSearchResults(results);
  }
});

// In handleSearch function
await searchMutation.mutateAsync({
  provider: selectedProvider,
  query: searchQuery,
  limit: 20,
  includeAdult: false,
  genres: selectedGenres,
  sortBy: sortCriteria,
  sortOrder: sortOrder
});
```

#### 1.2 `search.all`
**Location**: `/src/components/search/SearchForm.tsx`
**Integration**: Add "Search All Providers" toggle
```typescript
const searchAllQuery = trpc.search.all.useQuery({
  query: searchQuery,
  limit: 50,
  enabled: searchAllProviders && searchQuery.length > 2
});
```

#### 1.3 `search.getMetadata`
**Location**: `/src/pages/manga/[id].tsx`
**Integration**: Add metadata refresh button
```typescript
const getMetadataMutation = trpc.search.getMetadata.useMutation({
  onSuccess: (metadata) => {
    // Update manga with fresh metadata
    updateMangaMetadata(metadata);
  }
});
```

#### 1.4 `search.getProviders`
**Location**: `/src/pages/settings/search.tsx` (new page)
**Integration**: Create new search settings page
```typescript
const { data: providers } = trpc.search.getProviders.useQuery();
```

#### 1.5 `search.setDefaultProvider`
**Location**: `/src/pages/settings/search.tsx`
**Integration**: Add provider preference UI

### 2. Manga Management (14 endpoints)
**Priority: CRITICAL** - Essential features currently missing

#### 2.1 `manga.add`
**Location**: `/src/components/addManga/steps/confirmationStep.tsx`
**Current State**: Missing implementation after search
**Integration**:
```typescript
const addMangaMutation = trpc.manga.add.useMutation({
  onSuccess: (newManga) => {
    showSuccess('Manga added successfully');
    router.push(`/manga/${newManga.id}`);
  }
});

// In confirmation step
const handleAddManga = async () => {
  await addMangaMutation.mutateAsync({
    title: selectedManga.title,
    source: selectedProvider,
    libraryId: libraryId,
    metadata: {
      cover: selectedManga.coverUrl,
      description: selectedManga.description,
      status: selectedManga.status,
      genres: selectedManga.genres
    }
  });
};
```

#### 2.2 `manga.sources`
**Location**: `/src/components/addManga/steps/sourceStep.tsx`
**Integration**: Replace hardcoded sources
```typescript
const { data: sources } = trpc.manga.sources.useQuery();
```

#### 2.3 `manga.download`
**Location**: `/src/pages/manga/[id].tsx`
**Integration**: Add download button functionality
```typescript
const downloadMutation = trpc.manga.download.useMutation({
  onSuccess: () => {
    showNotification({
      title: 'Download Started',
      message: 'Chapters are being downloaded'
    });
  }
});

// In download button handler
const handleDownload = (chapterIndex?: number) => {
  downloadMutation.mutate({
    mangaId: manga.id,
    chapterIndex
  });
};
```

#### 2.4 `manga.bind`
**Location**: `/src/components/manga/MangaDetailView.tsx`
**Integration**: Add "Link to AniList" button
```typescript
const bindMutation = trpc.manga.bind.useMutation();
// Add UI for AniList binding modal
```

#### 2.5 `manga.refreshMetaData`
**Location**: `/src/pages/manga/[id].tsx`
**Integration**: Add refresh metadata button
```typescript
const refreshMetadataMutation = trpc.manga.refreshMetaData.useMutation({
  onSuccess: () => {
    refetch(); // Refresh manga data
    showSuccess('Metadata updated');
  }
});
```

#### 2.6 `manga.checkOutOfSyncChapters`
**Location**: `/src/components/homeActionBar.tsx`
**Current State**: Used once but not fully integrated
**Integration**: Add to manga detail page and create sync management UI

#### 2.7 `manga.fixOutOfSyncChapters`
**Location**: `/src/pages/manga/[id].tsx`
**Integration**: Add "Fix Out of Sync" button when issues detected

#### 2.8-2.11 Search Provider Endpoints
**Location**: `/src/components/addManga/steps/searchStep.tsx`
**Integration**: Enhance search step with multi-provider search

### 3. Settings Management (19 endpoints)
**Priority: MEDIUM** - Important for power users

#### 3.1 Search Configuration Endpoints
**New Page**: `/src/pages/settings/search-providers.tsx`
```typescript
export default function SearchProvidersSettings() {
  const { data: config } = trpc.settings.search.getConfig.useQuery();
  const updateConfigMutation = trpc.settings.search.updateConfig.useMutation();
  
  // Create UI for:
  // - Default provider selection
  // - Provider enable/disable toggles
  // - Provider-specific settings
  // - Prowlarr configuration
}
```

#### 3.2 File Organization Endpoints
**New Page**: `/src/pages/settings/file-organization.tsx`
```typescript
const { data: fileOrgSettings } = trpc.settings.getFileOrganization.useQuery();
const updateFileOrgMutation = trpc.settings.updateFileOrganization.useMutation();
```

#### 3.3 Backup/Restore Endpoints
**New Page**: `/src/pages/settings/backup.tsx`
```typescript
const backupMutation = trpc.settings.backupDatabase.useMutation();
const restoreMutation = trpc.settings.restoreDatabase.useMutation();
```

#### 3.4 Integration Settings
**Location**: `/src/pages/settings/integrations.tsx`
**Integration**: Enhance existing page with Komga/Kavita settings

### 4. System Management (10 endpoints)
**Priority: LOW-MEDIUM** - Admin features

#### 4.1 System Status Endpoints
**New Page**: `/src/pages/system/dashboard.tsx`
```typescript
export default function SystemDashboard() {
  const { data: health } = trpc.system.getHealth.useQuery();
  const { data: diskUsage } = trpc.system.getDiskUsage.useQuery();
  const { data: memoryUsage } = trpc.system.getMemoryUsage.useQuery();
  const { data: processInfo } = trpc.system.getProcessInfo.useQuery();
  
  return (
    <Dashboard>
      <HealthWidget data={health} />
      <ResourceUsageChart disk={diskUsage} memory={memoryUsage} />
      <ProcessList processes={processInfo} />
    </Dashboard>
  );
}
```

#### 4.2 Update Management
**Location**: `/src/pages/system/updates.tsx`
**Integration**: Add update check and install functionality
```typescript
const { data: updates } = trpc.system.checkForUpdates.useQuery();
const updateMutation = trpc.system.update.useMutation();
```

#### 4.3 Backup/Restore (System Level)
**Location**: `/src/pages/system/backup.tsx`
**Integration**: Create system-wide backup management UI

### 5. Task Management (5 endpoints)
**Priority: HIGH** - Improves user control

#### 5.1 Task Control Endpoints
**Location**: `/src/pages/tasks/[status].tsx`
**Integration**: Add action buttons to task lists
```typescript
const retryMutation = trpc.tasks.retry.useMutation({
  onSuccess: () => {
    refetch();
    showSuccess('Task restarted');
  }
});

const cancelMutation = trpc.tasks.cancel.useMutation({
  onSuccess: () => {
    refetch();
    showSuccess('Task cancelled');
  }
});

// In task item component
<ActionIcon onClick={() => retryMutation.mutate({ id: task.id })}>
  <IconRefresh />
</ActionIcon>
<ActionIcon onClick={() => cancelMutation.mutate({ id: task.id })}>
  <IconX />
</ActionIcon>
```

#### 5.2 Task Query Endpoints
**Location**: `/src/pages/tasks/index.tsx`
**Integration**: Create task dashboard with tabs
```typescript
const { data: queuedTasks } = trpc.tasks.getQueued.useQuery();
const { data: scheduledTasks } = trpc.tasks.getScheduled.useQuery();
const { data: tasksByType } = trpc.tasks.getByType.useQuery({ type: selectedType });
```

### 6. Completely Unused Routers

#### 6.1 Events Router
**New Component**: `/src/components/events/EventNotifications.tsx`
**Integration**: Create real-time notification system
```typescript
const { data: events } = trpc.events.subscribe.useSubscription();
```

#### 6.2 History Router
**New Page**: `/src/pages/history.tsx`
**Integration**: Create download history page
```typescript
const { data: history } = trpc.history.query.useQuery();
```

#### 6.3 Health Router
**Location**: Footer or system status widget
**Integration**: Add health indicator

## Implementation Roadmap

### Phase 1: Critical Features (Week 1-2)
1. **Manga Add Flow** (`manga.add`)
   - Complete the add manga workflow
   - Test with multiple providers

2. **Download Functionality** (`manga.download`)
   - Add download buttons to manga pages
   - Create download queue UI

3. **Search Integration** (`search.*` endpoints)
   - Replace direct provider calls
   - Add multi-provider search

### Phase 2: Essential Features (Week 3-4)
1. **Task Management**
   - Add retry/cancel buttons
   - Create task dashboard

2. **Metadata Management**
   - Refresh metadata functionality
   - Provider selection for updates

3. **Out of Sync Management**
   - Detection and fixing UI
   - Automatic sync options

### Phase 3: Configuration (Week 5-6)
1. **Search Settings Page**
   - Provider configuration
   - Default provider selection

2. **File Organization Settings**
   - Folder structure options
   - Naming templates

3. **Backup/Restore**
   - Manual backup UI
   - Restore functionality

### Phase 4: Advanced Features (Week 7-8)
1. **System Dashboard**
   - Health monitoring
   - Resource usage

2. **Integration Settings**
   - Komga/Kavita configuration
   - Notification settings

3. **History and Events**
   - Download history page
   - Real-time notifications

## Code Migration Examples

### Example 1: Migrating Search to tRPC
**Before** (Direct Provider):
```typescript
const results = await provider.search(query);
```

**After** (tRPC Endpoint):
```typescript
const { data: results } = await trpc.search.withProvider.query({
  provider: 'anilist',
  query: searchTerm,
  limit: 20
});
```

### Example 2: Adding Download Functionality
```typescript
// In ChapterList component
interface ChapterListProps {
  manga: MangaEntity;
  onDownload: (mangaId: number, chapterIds: number[]) => void;
}

// Add download button
<Button
  leftIcon={<IconDownload />}
  onClick={() => {
    trpc.manga.download.mutate({
      mangaId: manga.id,
      chapterIndex: chapter.index
    });
  }}
>
  Download
</Button>
```

### Example 3: Task Management UI
```typescript
// TaskItem component
export function TaskItem({ task }: { task: Task }) {
  const utils = trpc.useContext();
  
  const retryMutation = trpc.tasks.retry.useMutation({
    onSuccess: () => {
      utils.tasks.getByStatus.invalidate();
    }
  });
  
  return (
    <Card>
      <Group position="apart">
        <Text>{task.name}</Text>
        <Group>
          {task.status === 'FAILED' && (
            <Button
              size="xs"
              onClick={() => retryMutation.mutate({ id: task.id })}
            >
              Retry
            </Button>
          )}
          <Button
            size="xs"
            color="red"
            onClick={() => cancelMutation.mutate({ id: task.id })}
          >
            Cancel
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
```

## Testing Strategy

### Unit Tests
```typescript
// Test search integration
describe('Search Integration', () => {
  it('should search with provider', async () => {
    const { result } = renderHook(() => 
      trpc.search.withProvider.useQuery({
        provider: 'anilist',
        query: 'One Piece'
      })
    );
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data.length).toBeGreaterThan(0);
    });
  });
});
```

### Integration Tests
- Test complete workflows (search → add → download)
- Verify error handling
- Check loading states

## Migration Checklist

- [ ] Create missing pages for settings
- [ ] Add navigation menu items
- [ ] Implement manga add workflow
- [ ] Add download functionality
- [ ] Create task management UI
- [ ] Implement search settings
- [ ] Add backup/restore UI
- [ ] Create system dashboard
- [ ] Add real-time notifications
- [ ] Implement history page
- [ ] Update documentation
- [ ] Add integration tests
- [ ] Performance testing
- [ ] User acceptance testing

## Conclusion

The integration of these 59 unused endpoints will transform Mugiwara-Kaizoku from a basic manga viewer into a full-featured manga management system. The phased approach ensures critical features are delivered first while maintaining code quality and user experience.

Total estimated time: 8 weeks for full implementation
Recommended team size: 2-3 developers
