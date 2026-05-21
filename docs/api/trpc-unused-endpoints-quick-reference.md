# Trpc Unused Endpoints Quick Reference

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Trpc Unused Endpoints Quick Reference

---
# tRPC Unused Endpoints - Quick Reference Guide

## Summary Statistics
- **Total Unused Endpoints**: 59 (70% of all endpoints)
- **Critical Missing Features**: 14 manga management endpoints
- **New Pages Required**: 8
- **Components to Modify**: 15+
- **Estimated Development Time**: 8 weeks

## Priority Classification

### 🔴 CRITICAL (Must Have) - 16 endpoints
These directly impact core functionality:

1. **manga.add** - Users can't add manga
2. **manga.download** - No download functionality
3. **manga.sources** - Can't see available sources
4. **search.withProvider** - Search not using tRPC
5. **search.all** - No multi-provider search
6. **tasks.retry** - Can't retry failed tasks
7. **tasks.cancel** - Can't cancel running tasks

### 🟡 HIGH (Should Have) - 23 endpoints
Important for complete user experience:

1. **manga.refreshMetaData** - Manual metadata updates
2. **manga.bind** - AniList integration
3. **manga.checkOutOfSyncChapters** - Sync detection
4. **manga.fixOutOfSyncChapters** - Sync repair
5. **settings.search.*** - Search configuration
6. **settings.getFileOrganization** - File management
7. **system.getHealth** - System monitoring

### 🟢 MEDIUM (Nice to Have) - 20 endpoints
Enhanced features for power users:

1. **settings.backup/restore** - Data backup
2. **system.update** - Update management
3. **events.*** - Real-time notifications
4. **history.*** - Activity tracking

## File Changes by Endpoint

### Search System (5 endpoints)

| Endpoint | Files to Create | Files to Modify |
|----------|----------------|-----------------|
| search.withProvider | - | `/src/hooks/useDomainSearch.ts`<br>`/src/components/search/SearchForm.tsx` |
| search.all | `/src/components/search/MultiProviderSearch.tsx` | `/src/components/search/SearchForm.tsx` |
| search.getMetadata | - | `/src/pages/manga/[id].tsx` |
| search.getProviders | `/src/pages/settings/search-providers.tsx` | `/src/pages/settings/index.tsx` |
| search.setDefaultProvider | - | `/src/pages/settings/search-providers.tsx` |

### Manga Management (14 endpoints)

| Endpoint | Files to Create | Files to Modify |
|----------|----------------|-----------------|
| manga.add | - | `/src/components/addManga/steps/confirmationStep.tsx` |
| manga.sources | - | `/src/components/addManga/steps/sourceStep.tsx` |
| manga.download | `/src/components/manga/DownloadManager.tsx` | `/src/pages/manga/[id].tsx` |
| manga.bind | `/src/components/manga/AniListBindModal.tsx` | `/src/pages/manga/[id].tsx` |
| manga.refreshMetaData | - | `/src/pages/manga/[id].tsx` |
| manga.checkOutOfSyncChapters | `/src/components/manga/SyncStatusCard.tsx` | `/src/pages/manga/[id].tsx` |
| manga.fixOutOfSyncChapters | - | `/src/components/manga/SyncStatusCard.tsx` |
| manga.searchAcrossProviders | - | `/src/components/addManga/steps/searchStep.tsx` |
| manga.searchProviderConfirmation | - | `/src/components/addManga/steps/confirmationStep.tsx` |
| manga.getProviderMetadata | `/src/components/manga/ProviderMetadataModal.tsx` | - |
| manga.updateProviderPreferences | - | `/src/components/manga/ProviderMetadataModal.tsx` |

### Settings Management (19 endpoints)

| Endpoint Group | New Pages | Components |
|----------------|-----------|------------|
| settings.search.* | `/src/pages/settings/search-providers.tsx` | `SearchProviderConfig`<br>`ProwlarrSettings`<br>`ProviderToggleList` |
| settings.fileOrganization | `/src/pages/settings/file-organization.tsx` | `FolderStructureSelect`<br>`NamingTemplateInput` |
| settings.backup/restore | `/src/pages/settings/backup.tsx` | `BackupScheduler`<br>`RestoreModal` |
| settings.integrations | - | `KomgaConfig`<br>`KavitaConfig` |

### Task Management (5 endpoints)

| Endpoint | Files to Create | Files to Modify |
|----------|----------------|-----------------|
| tasks.retry | `/src/components/tasks/TaskActions.tsx` | `/src/pages/tasks/[status].tsx` |
| tasks.cancel | - | `/src/components/tasks/TaskActions.tsx` |
| tasks.getQueued | `/src/pages/tasks/dashboard.tsx` | - |
| tasks.getScheduled | - | `/src/pages/tasks/dashboard.tsx` |
| tasks.getByType | - | `/src/pages/tasks/dashboard.tsx` |

### System Management (10 endpoints)

| Endpoint | Files to Create | Files to Modify |
|----------|----------------|-----------------|
| system.getHealth | `/src/pages/system/dashboard.tsx` | `/src/components/layouts/Footer.tsx` |
| system.getDiskUsage | - | `/src/pages/system/dashboard.tsx` |
| system.getMemoryUsage | - | `/src/pages/system/dashboard.tsx` |
| system.backup/restore | `/src/pages/system/backup.tsx` | - |
| system.update | `/src/pages/system/updates.tsx` | - |

## Navigation Updates Required

Add these menu items to `/src/components/navbar.tsx`:

```typescript
// Settings submenu additions
{
  label: 'Search Providers',
  href: '/settings/search-providers',
  icon: <IconSearch />
},
{
  label: 'File Organization', 
  href: '/settings/file-organization',
  icon: <IconFolder />
},
{
  label: 'Backup & Restore',
  href: '/settings/backup',
  icon: <IconDatabase />
}

// System submenu additions
{
  label: 'Dashboard',
  href: '/system/dashboard',
  icon: <IconDashboard />
},
{
  label: 'Task Manager',
  href: '/tasks/dashboard',
  icon: <IconListCheck />
}
```

## Component Creation Templates

### Template: Settings Page
```typescript
// /src/pages/settings/[feature].tsx
import { Container, Title, Card, Stack } from '@mantine/core';
import { trpc } from '../../utils/trpc-client';

export default function [Feature]Settings() {
  const { data: settings } = trpc.settings.get[Feature].useQuery();
  const updateMutation = trpc.settings.update[Feature].useMutation();
  
  return (
    <Container>
      <Title order={2}>Feature Settings</Title>
      <Card>
        <Stack>
          {/* Settings form */}
        </Stack>
      </Card>
    </Container>
  );
}
```

### Template: Action Component
```typescript
// /src/components/[feature]/[Feature]Actions.tsx
export function [Feature]Actions({ item }) {
  const utils = trpc.useContext();
  const actionMutation = trpc.[router].[action].useMutation({
    onSuccess: () => {
      utils.[router].invalidate();
      notifications.show({ message: 'Success' });
    }
  });
  
  return (
    <Group>
      <Button onClick={() => actionMutation.mutate({ id: item.id })}>
        Action
      </Button>
    </Group>
  );
}
```

## Implementation Checklist

### Phase 1: Core Features (Week 1-2)
- [ ] Integrate `manga.add` in confirmation step
- [ ] Add download buttons using `manga.download`
- [ ] Replace search with `search.withProvider`
- [ ] Add source list using `manga.sources`

### Phase 2: Essential Features (Week 3-4)
- [ ] Create task dashboard with retry/cancel
- [ ] Add metadata refresh button
- [ ] Implement sync detection and fixing
- [ ] Create search settings page

### Phase 3: Configuration (Week 5-6)
- [ ] Build file organization settings
- [ ] Add backup/restore functionality
- [ ] Create provider configuration UI
- [ ] Implement integration settings

### Phase 4: Advanced Features (Week 7-8)
- [ ] Build system dashboard
- [ ] Add update management
- [ ] Create history page
- [ ] Implement real-time events

## Common Integration Patterns

### Pattern 1: Query with Cache
```typescript
const { data } = trpc.[router].[query].useQuery(undefined, {
  staleTime: 5 * 60 * 1000,
  cacheTime: 10 * 60 * 1000
});
```

### Pattern 2: Mutation with Invalidation
```typescript
const mutation = trpc.[router].[action].useMutation({
  onSuccess: () => {
    utils.[router].invalidate();
  }
});
```

### Pattern 3: Subscription (for events)
```typescript
trpc.[router].[subscription].useSubscription(undefined, {
  onData: (data) => {
    // Handle real-time data
  }
});
```

## Quick Wins (Can be done in 1 day each)

1. **Add Download Button** - Just connect existing UI to `manga.download`
2. **Task Retry/Cancel** - Add action buttons to task lists
3. **Refresh Metadata** - Add button to manga detail page
4. **Source List** - Replace hardcoded list with `manga.sources`
5. **Search Settings Link** - Add menu item and basic page

## Dependencies to Install

None required! All endpoints use existing tRPC setup.

## Testing Checklist

- [ ] Test add manga flow end-to-end
- [ ] Verify download functionality
- [ ] Check task retry/cancel
- [ ] Test search with all providers
- [ ] Verify settings persistence
- [ ] Test backup/restore
- [ ] Check system monitoring
- [ ] Verify error handling

## Notes for Developers

1. **All endpoints are ready** - No backend work needed
2. **Use existing patterns** - Follow current tRPC usage
3. **Cache aggressively** - Most data doesn't change often
4. **Handle errors consistently** - Use notification system
5. **Invalidate smartly** - Only refresh affected queries

## Next Steps

1. Start with Critical endpoints (manga.add, download)
2. Create new pages for settings
3. Add navigation menu items
4. Test each integration thoroughly
5. Document any issues or limitations
