# Trpc Unused Endpoints Technical Analysis

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Trpc Unused Endpoints Technical Analysis

---
# tRPC Unused Endpoints - Technical Integration Analysis

## Overview

This document provides a technical deep-dive into integrating the 59 unused tRPC endpoints. It includes specific code patterns, UI mockups, state management strategies, and migration paths.

## Endpoint Integration Details

### 1. Search System (5 endpoints)

#### Endpoints Analysis
```typescript
// Current unused endpoints
search.withProvider     // Search with specific provider
search.all             // Search across all providers  
search.getMetadata     // Get detailed metadata
search.getProviders    // List available providers
search.setDefaultProvider // Set default search provider
```

#### Current Implementation Gap
- **Problem**: Search is performed directly through providers without tRPC
- **Location**: `/src/hooks/useDomainSearch.ts` and `/src/contexts/search/*`
- **Impact**: Missing centralized search configuration and caching

#### Integration Strategy
```typescript
// NEW: /src/hooks/useSearchEndpoints.ts
export function useSearchEndpoints() {
  const utils = trpc.useContext();
  
  // Replace direct provider calls
  const searchWithProvider = trpc.search.withProvider.useMutation({
    onSuccess: (data) => {
      // Cache results
      utils.search.getMetadata.setData(
        data.map(item => ({ provider: item.provider, id: item.id }))
      );
    }
  });
  
  const searchAll = trpc.search.all.useQuery({
    enabled: false, // Manual trigger
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  return {
    searchWithProvider,
    searchAll,
    getMetadata: trpc.search.getMetadata.useQuery,
    providers: trpc.search.getProviders.useQuery(),
    setDefaultProvider: trpc.search.setDefaultProvider.useMutation()
  };
}
```

#### New UI Components
```typescript
// NEW: /src/components/search/SearchProviderSelector.tsx
export function SearchProviderSelector() {
  const { providers, setDefaultProvider } = useSearchEndpoints();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  
  return (
    <Select
      label="Search Provider"
      data={providers.data?.map(p => ({ value: p, label: p })) || []}
      value={selectedProvider}
      onChange={(value) => {
        setSelectedProvider(value);
        setDefaultProvider.mutate({ provider: value });
      }}
    />
  );
}
```

### 2. Manga Management (14 endpoints)

#### Critical Missing Features
```typescript
manga.add                    // Add new manga
manga.sources               // Get available sources
manga.bind                  // Bind to AniList
manga.refreshMetaData       // Refresh metadata
manga.download              // Download chapters
manga.checkOutOfSyncChapters // Check sync status
manga.fixOutOfSyncChapters  // Fix sync issues
manga.searchAcrossProviders // Multi-provider search
manga.searchProviderConfirmation // Provider confirmation
manga.getProviderMetadata   // Get provider metadata
manga.updateProviderPreferences // Update preferences
manga.detail                // Get detailed info (alias)
```

#### Add Manga Flow Integration
```typescript
// MODIFY: /src/components/addManga/steps/confirmationStep.tsx
import { trpc } from '../../../utils/trpc-client';

export function ConfirmationStep({ 
  selectedManga, 
  selectedProvider, 
  libraryId,
  onComplete 
}: ConfirmationStepProps) {
  const addMangaMutation = trpc.manga.add.useMutation({
    onSuccess: (newManga) => {
      notifications.show({
        title: 'Success',
        message: `${newManga.title} added to library`,
        color: 'green'
      });
      onComplete(newManga);
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    }
  });
  
  const handleConfirm = async () => {
    await addMangaMutation.mutateAsync({
      title: selectedManga.title,
      source: selectedProvider,
      libraryId: libraryId,
      mangaId: selectedManga.id,
      interval: 'daily',
      metadata: {
        cover: selectedManga.coverUrl,
        description: selectedManga.description,
        status: selectedManga.status,
        genres: selectedManga.genres || []
      }
    });
  };
  
  return (
    <Stack>
      <Title order={3}>Confirm Addition</Title>
      <Card>
        <Group>
          <Image src={selectedManga.coverUrl} width={100} />
          <Stack>
            <Text weight={500}>{selectedManga.title}</Text>
            <Text size="sm" color="dimmed">Provider: {selectedProvider}</Text>
            <Text size="sm" color="dimmed">Library: {libraryId}</Text>
          </Stack>
        </Group>
      </Card>
      <Group position="right">
        <Button onClick={handleConfirm} loading={addMangaMutation.isLoading}>
          Add to Library
        </Button>
      </Group>
    </Stack>
  );
}
```

#### Download Management
```typescript
// NEW: /src/components/manga/DownloadManager.tsx
export function DownloadManager({ manga }: { manga: MangaEntity }) {
  const downloadMutation = trpc.manga.download.useMutation();
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  
  const handleDownloadAll = () => {
    downloadMutation.mutate({ 
      mangaId: manga.id 
    });
  };
  
  const handleDownloadSelected = () => {
    selectedChapters.forEach(chapterIndex => {
      downloadMutation.mutate({ 
        mangaId: manga.id,
        chapterIndex 
      });
    });
  };
  
  return (
    <Card>
      <Stack>
        <Group position="apart">
          <Title order={4}>Download Management</Title>
          <Badge>{downloadMutation.isLoading ? 'Downloading...' : 'Ready'}</Badge>
        </Group>
        
        <Group>
          <Button 
            leftIcon={<IconDownload />}
            onClick={handleDownloadAll}
            disabled={downloadMutation.isLoading}
          >
            Download All
          </Button>
          
          <Button 
            leftIcon={<IconDownload />}
            onClick={handleDownloadSelected}
            disabled={selectedChapters.length === 0 || downloadMutation.isLoading}
          >
            Download Selected ({selectedChapters.length})
          </Button>
        </Group>
        
        <ChapterSelectionList 
          chapters={manga.chapters}
          onSelectionChange={setSelectedChapters}
        />
      </Stack>
    </Card>
  );
}
```

#### Sync Management
```typescript
// NEW: /src/components/manga/SyncStatusCard.tsx
export function SyncStatusCard({ mangaId }: { mangaId: number }) {
  const checkSyncMutation = trpc.manga.checkOutOfSyncChapters.useMutation();
  const fixSyncMutation = trpc.manga.fixOutOfSyncChapters.useMutation();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  const handleCheckSync = async () => {
    const result = await checkSyncMutation.mutateAsync({ mangaId });
    setSyncStatus(result);
  };
  
  const handleFixSync = async () => {
    await fixSyncMutation.mutateAsync({ id: mangaId });
    await handleCheckSync(); // Recheck after fix
  };
  
  return (
    <Card>
      <Stack>
        <Group position="apart">
          <Text weight={500}>Sync Status</Text>
          <ActionIcon onClick={handleCheckSync}>
            <IconRefresh />
          </ActionIcon>
        </Group>
        
        {syncStatus && (
          <>
            <Badge color={syncStatus.outOfSyncCount > 0 ? 'red' : 'green'}>
              {syncStatus.outOfSyncCount > 0 
                ? `${syncStatus.outOfSyncCount} chapters out of sync`
                : 'All chapters synced'
              }
            </Badge>
            
            {syncStatus.outOfSyncCount > 0 && (
              <Button 
                color="red" 
                onClick={handleFixSync}
                loading={fixSyncMutation.isLoading}
              >
                Fix Sync Issues
              </Button>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
```

### 3. Settings Management (19 endpoints)

#### Search Settings Page Structure
```typescript
// NEW: /src/pages/settings/search-providers.tsx
export default function SearchProvidersSettings() {
  const { data: config } = trpc.settings.search.getConfig.useQuery();
  const updateConfig = trpc.settings.search.updateConfig.useMutation();
  const { data: providers } = trpc.settings.search.listProviders.useQuery();
  
  return (
    <Container>
      <Title order={2} mb="xl">Search Provider Settings</Title>
      
      <Tabs defaultValue="providers">
        <Tabs.List>
          <Tabs.Tab value="providers">Providers</Tabs.Tab>
          <Tabs.Tab value="prowlarr">Prowlarr</Tabs.Tab>
          <Tabs.Tab value="preferences">Preferences</Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="providers">
          <ProviderConfigPanel 
            providers={providers?.data || []}
            config={config?.data?.config}
            onUpdate={updateConfig.mutate}
          />
        </Tabs.Panel>
        
        <Tabs.Panel value="prowlarr">
          <ProwlarrConfigPanel />
        </Tabs.Panel>
        
        <Tabs.Panel value="preferences">
          <SearchPreferencesPanel />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
```

#### File Organization Settings
```typescript
// NEW: /src/pages/settings/file-organization.tsx
export default function FileOrganizationSettings() {
  const { data: settings } = trpc.settings.getFileOrganization.useQuery();
  const updateSettings = trpc.settings.updateFileOrganization.useMutation();
  
  const form = useForm({
    initialValues: settings?.settings || {
      folderStructure: 'byTitle',
      customFolderTemplate: '',
      fileNamingTemplate: '{title} - {chapter}',
      createMetadataFiles: true,
      organizeOnImport: true,
      preserveOriginalFiles: false
    }
  });
  
  return (
    <form onSubmit={form.onSubmit(values => updateSettings.mutate(values))}>
      <Stack>
        <Select
          label="Folder Structure"
          {...form.getInputProps('folderStructure')}
          data={[
            { value: 'flat', label: 'Flat (no folders)' },
            { value: 'byTitle', label: 'By Title' },
            { value: 'byTitleYear', label: 'By Title and Year' },
            { value: 'byPublisher', label: 'By Publisher' },
            { value: 'custom', label: 'Custom Template' }
          ]}
        />
        
        {form.values.folderStructure === 'custom' && (
          <TextInput
            label="Custom Folder Template"
            {...form.getInputProps('customFolderTemplate')}
            placeholder="{publisher}/{title} ({year})"
          />
        )}
        
        <TextInput
          label="File Naming Template"
          {...form.getInputProps('fileNamingTemplate')}
          placeholder="{title} - {volume} - {chapter}"
        />
        
        <Switch
          label="Create metadata files (.nfo)"
          {...form.getInputProps('createMetadataFiles', { type: 'checkbox' })}
        />
        
        <Switch
          label="Organize files on import"
          {...form.getInputProps('organizeOnImport', { type: 'checkbox' })}
        />
        
        <Switch
          label="Preserve original files"
          {...form.getInputProps('preserveOriginalFiles', { type: 'checkbox' })}
        />
        
        <Group position="right">
          <Button type="submit" loading={updateSettings.isLoading}>
            Save Settings
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
```

### 4. Task Management UI

#### Task Dashboard
```typescript
// NEW: /src/pages/tasks/dashboard.tsx
export default function TaskDashboard() {
  const { data: queuedTasks } = trpc.tasks.getQueued.useQuery();
  const { data: scheduledTasks } = trpc.tasks.getScheduled.useQuery();
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  
  const { data: tasksByType } = trpc.tasks.getByType.useQuery(
    { type: selectedType! },
    { enabled: !!selectedType }
  );
  
  return (
    <Container>
      <Title order={2} mb="xl">Task Management</Title>
      
      <Grid>
        <Grid.Col span={12} md={4}>
          <Card>
            <Text size="lg" weight={500}>Queued Tasks</Text>
            <Text size="xl" weight={700}>{queuedTasks?.length || 0}</Text>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={12} md={4}>
          <Card>
            <Text size="lg" weight={500}>Scheduled Tasks</Text>
            <Text size="xl" weight={700}>{scheduledTasks?.length || 0}</Text>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={12} md={4}>
          <Card>
            <Text size="lg" weight={500}>Active Tasks</Text>
            <Text size="xl" weight={700}>
              {queuedTasks?.filter(t => t.status === 'IN_PROGRESS').length || 0}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
      
      <Tabs defaultValue="queued" mt="xl">
        <Tabs.List>
          <Tabs.Tab value="queued">Queued</Tabs.Tab>
          <Tabs.Tab value="scheduled">Scheduled</Tabs.Tab>
          <Tabs.Tab value="byType">By Type</Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="queued">
          <TaskList tasks={queuedTasks || []} />
        </Tabs.Panel>
        
        <Tabs.Panel value="scheduled">
          <TaskList tasks={scheduledTasks || []} showScheduledTime />
        </Tabs.Panel>
        
        <Tabs.Panel value="byType">
          <Select
            label="Task Type"
            value={selectedType}
            onChange={setSelectedType}
            data={Object.values(TaskType).map(type => ({
              value: type,
              label: type.replace(/_/g, ' ')
            }))}
          />
          {selectedType && <TaskList tasks={tasksByType || []} />}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
```

#### Task Actions Component
```typescript
// NEW: /src/components/tasks/TaskActions.tsx
export function TaskActions({ task }: { task: Task }) {
  const utils = trpc.useContext();
  const retryMutation = trpc.tasks.retry.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      notifications.show({
        title: 'Task Restarted',
        message: `Task ${task.id} has been queued for retry`,
        color: 'blue'
      });
    }
  });
  
  const cancelMutation = trpc.tasks.cancel.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      notifications.show({
        title: 'Task Cancelled',
        message: `Task ${task.id} has been cancelled`,
        color: 'orange'
      });
    }
  });
  
  return (
    <Group spacing="xs">
      {task.status === 'FAILED' && (
        <Tooltip label="Retry task">
          <ActionIcon 
            color="blue" 
            onClick={() => retryMutation.mutate({ id: task.id })}
            loading={retryMutation.isLoading}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      )}
      
      {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
        <Tooltip label="Cancel task">
          <ActionIcon 
            color="red" 
            onClick={() => cancelMutation.mutate({ id: task.id })}
            loading={cancelMutation.isLoading}
          >
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
```

### 5. System Management

#### System Dashboard
```typescript
// NEW: /src/pages/system/dashboard.tsx
export default function SystemDashboard() {
  const { data: health } = trpc.system.getHealth.useQuery(
    undefined,
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );
  
  const { data: diskUsage } = trpc.system.getDiskUsage.useQuery();
  const { data: memoryUsage } = trpc.system.getMemoryUsage.useQuery();
  const { data: processInfo } = trpc.system.getProcessInfo.useQuery();
  
  return (
    <Container>
      <Title order={2} mb="xl">System Dashboard</Title>
      
      <Grid>
        <Grid.Col span={12} md={6} lg={3}>
          <Card>
            <Text size="sm" color="dimmed">Health Status</Text>
            <Badge 
              size="lg" 
              color={health?.status === 'healthy' ? 'green' : 'red'}
            >
              {health?.status || 'Unknown'}
            </Badge>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={12} md={6} lg={3}>
          <Card>
            <Text size="sm" color="dimmed">Disk Usage</Text>
            <RingProgress
              sections={[{
                value: diskUsage?.percentage || 0,
                color: diskUsage?.percentage > 80 ? 'red' : 'blue'
              }]}
              label={
                <Center>
                  <Text size="xs">{diskUsage?.percentage || 0}%</Text>
                </Center>
              }
            />
          </Card>
        </Grid.Col>
        
        <Grid.Col span={12} md={6} lg={3}>
          <Card>
            <Text size="sm" color="dimmed">Memory Usage</Text>
            <RingProgress
              sections={[{
                value: memoryUsage?.percentage || 0,
                color: memoryUsage?.percentage > 80 ? 'red' : 'green'
              }]}
              label={
                <Center>
                  <Text size="xs">{memoryUsage?.percentage || 0}%</Text>
                </Center>
              }
            />
          </Card>
        </Grid.Col>
        
        <Grid.Col span={12} md={6} lg={3}>
          <Card>
            <Text size="sm" color="dimmed">Active Processes</Text>
            <Text size="xl" weight={700}>
              {processInfo?.length || 0}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
      
      <Card mt="xl">
        <Title order={4} mb="md">Process Information</Title>
        <Table>
          <thead>
            <tr>
              <th>Process</th>
              <th>CPU %</th>
              <th>Memory</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {processInfo?.map(process => (
              <tr key={process.pid}>
                <td>{process.name}</td>
                <td>{process.cpu}%</td>
                <td>{formatBytes(process.memory)}</td>
                <td>
                  <Badge color={process.status === 'running' ? 'green' : 'gray'}>
                    {process.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Container>
  );
}
```

### 6. State Management Strategy

#### Global Store Integration
```typescript
// MODIFY: /src/store/index.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppState {
  // Search state
  defaultProvider: string | null;
  searchHistory: SearchResult[];
  
  // Task state
  activeTasks: Task[];
  taskNotifications: boolean;
  
  // System state
  systemHealth: SystemHealth | null;
  lastBackupDate: Date | null;
  
  // Actions
  setDefaultProvider: (provider: string) => void;
  addSearchHistory: (result: SearchResult) => void;
  updateSystemHealth: (health: SystemHealth) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // Initial state
      defaultProvider: null,
      searchHistory: [],
      activeTasks: [],
      taskNotifications: true,
      systemHealth: null,
      lastBackupDate: null,
      
      // Actions
      setDefaultProvider: (provider) => set({ defaultProvider: provider }),
      addSearchHistory: (result) => set((state) => ({
        searchHistory: [result, ...state.searchHistory].slice(0, 50) // Keep last 50
      })),
      updateSystemHealth: (health) => set({ systemHealth: health })
    })
  )
);
```

#### Query Invalidation Patterns
```typescript
// utils/trpc-invalidation.ts
export function useSmartInvalidation() {
  const utils = trpc.useContext();
  
  return {
    // Invalidate all manga-related queries
    invalidateManga: (mangaId?: number) => {
      if (mangaId) {
        utils.manga.get.invalidate({ id: mangaId });
        utils.manga.detail.invalidate({ id: mangaId });
      } else {
        utils.manga.query.invalidate();
      }
    },
    
    // Invalidate task queries
    invalidateTasks: () => {
      utils.tasks.getQueued.invalidate();
      utils.tasks.getScheduled.invalidate();
      utils.tasks.getByStatus.invalidate();
    },
    
    // Invalidate settings
    invalidateSettings: (key?: string) => {
      if (key) {
        utils.settings.get.invalidate({ key });
      } else {
        utils.settings.invalidate();
      }
    }
  };
}
```

## Migration Timeline

### Week 1: Foundation
- [ ] Create search settings page
- [ ] Integrate manga.add endpoint
- [ ] Add download functionality

### Week 2: Core Features  
- [ ] Implement task retry/cancel
- [ ] Add metadata refresh
- [ ] Create sync management UI

### Week 3: Configuration
- [ ] File organization settings
- [ ] Provider configuration
- [ ] Backup/restore UI

### Week 4: Advanced Features
- [ ] System dashboard
- [ ] Real-time notifications
- [ ] History tracking

## Performance Considerations

### Query Optimization
```typescript
// Use React Query features effectively
const mangaQuery = trpc.manga.query.useQuery(undefined, {
  staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  refetchInterval: false, // Don't refetch automatically
  refetchOnWindowFocus: false, // Don't refetch on focus
});
```

### Batch Operations
```typescript
// Batch multiple mutations
const batchDownload = async (chapterIds: number[]) => {
  await Promise.all(
    chapterIds.map(chapterId => 
      downloadMutation.mutateAsync({ mangaId, chapterId })
    )
  );
};
```

## Error Handling Patterns

### Consistent Error Display
```typescript
// hooks/useErrorHandler.ts
export function useErrorHandler() {
  return {
    handleError: (error: TRPCClientError<AppRouter>) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        autoClose: 5000
      });
      
      // Log to monitoring service
      console.error('tRPC Error:', {
        code: error.data?.code,
        message: error.message,
        stack: error.data?.stack
      });
    }
  };
}
```

## Testing Requirements

### Integration Tests
```typescript
// __tests__/manga-add-flow.test.tsx
describe('Manga Add Flow', () => {
  it('should complete full add workflow', async () => {
    // Mock tRPC endpoints
    const mockAdd = vi.fn().mockResolvedValue({ id: 1, title: 'Test Manga' });
    
    // Test search → select → confirm → add flow
    // Verify manga.add is called with correct params
  });
});
```

## Conclusion

The integration of these unused endpoints represents a significant enhancement to the application. By following this technical plan, developers can systematically add these features while maintaining code quality and user experience.
