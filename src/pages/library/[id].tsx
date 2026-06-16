/**
 * Enhanced Library Page with Phase 5 Features
 *
 * Integrates:
 * - Enhanced search with suggestions and multi-field support
 * - Advanced filters with date ranges, chapter counts, genres/tags
 * - Alphabet navigation with grouping
 * - All existing library features
 *
 * @module pages/library/[id]
 */
"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { Box, Center, Loader, ScrollArea, SegmentedControl, Stack, Text, Group, ActionIcon, Menu, Button, Modal, Container, Title, Badge, Tooltip } from "@mantine/core";
import { IconEdit, IconTrash, IconPlus, IconFilter, IconRefresh, IconDotsVertical, IconArrowLeft, IconCircleCheck, IconEye, IconBook } from '@tabler/icons-react';
import { useRouter } from "next/router";

import { AddMangaModal } from '@/components/addManga/AddMangaModal';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { BulkDeleteModal } from '@/components/library/BulkDeleteModal';
import { BulkMonitorModal } from '@/components/library/BulkMonitorModal';
import { EditLibraryModal } from '@/components/library/EditLibraryModal';
import { AdvancedFilters } from '@/components/library/filters/AdvancedFilters';
import { LibraryContent } from '@/components/library/LibraryContent';
import { MangaCardSkeletonGrid } from '@/components/library/MangaCardSkeleton';
import { filterAndSortManga, getAvailableGenres, getAvailableTags } from '@/components/library/utils/libraryUtils';
import { useComicvineConfig } from '@/hooks/useComicvineConfig';
import { useLibrary } from '@/hooks/useLibrary';
import { useLibraryMangaAccumulator } from '@/hooks/useLibraryMangaAccumulator';
import { useNavigation } from '@/hooks/useNavigation';
import { useNotification } from '@/hooks/useNotification';
import { useLibraryStore, useLibraryViewStore } from '@/store/index';
import type { MangaWithRelations } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { withRemovalToast } from '@/utils/removalToast';
import { trpc } from '@/utils/trpc-client/index';

/**
 * Enhanced Library Page Component
 */
// eslint-disable-next-line complexity, max-statements -- Library page with multiple modal states, filtering, sorting, bulk operations, responsive UI
function LibraryPage(): React.ReactElement {
    const [editModalOpened, setEditModalOpened] = useState(false);
    const [deleteModalOpened, setDeleteModalOpened] = useState(false);
    const [advancedFiltersOpened, setAdvancedFiltersOpened] = useState(false);
    const [addMangaModalOpened, setAddMangaModalOpened] = useState(false);
    const [bulkDeleteModalOpened, setBulkDeleteModalOpened] = useState(false);
    const [bulkMonitorModalOpened, setBulkMonitorModalOpened] = useState(false);
    const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'manga' | 'comicbook'>('all');
    const { config: cvConfig } = useComicvineConfig();
    const comicbookTrackingEnabled = cvConfig.comicbookTrackingEnabled;
    const router = useRouter();
    const { navigateTo } = useNavigation();
    const { id } = router.query;
    // Get library view state
    const { sortBy, filterBy, searchQuery, searchField, enableRegexSearch, advancedFilters, selectionMode, selectedItems } = useLibraryViewStore();
    const coverSize = useLibraryViewStore(state => state.coverSize);
    const setSelectionMode = useLibraryViewStore(state => state.setSelectionMode);
    const selectAll = useLibraryViewStore(state => state.selectAll);
    const clearSelection = useLibraryViewStore(state => state.clearSelection);
    // Parse library ID
    let libraryId: number | undefined;
    if (Array.isArray(id)) {
        libraryId = toNumberId(id[0]);
    }
    else if (typeof id === 'string') {
        libraryId = toNumberId(id);
    }
    const hasValidId = libraryId && !isNaN(libraryId);
    // Get library store actions
    const setTargetLibraryId = useLibraryStore(state => state.setTargetLibraryId);
    const { showSuccess, showError } = useNotification();
    // Mutation for deleting library
    const deleteLibraryMutation = trpc.library.delete.useMutation();
    // Bulk action mutations
    const bulkRefreshMutation = trpc.bulk.bulkRefreshMetadata.useMutation();
    const bulkDeleteMutation = trpc.bulk.removeManga.useMutation();
    const bulkMonitorMutation = trpc.manga.bulkToggleMonitoring.useMutation();
    // State for refresh loading
    const [refreshing, setRefreshing] = useState(false);
    // Set the selected library ID
    useEffect(() => {
        if (hasValidId && libraryId) {
            setTargetLibraryId(libraryId);
        }
    }, [hasValidId, libraryId, setTargetLibraryId]);
    // Fetch library data
    const { library, manga: _basicManga, error, refreshLibrary, isLoading } = useLibrary(hasValidId ? libraryId : undefined);

    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const {
        allManga, hasMore, isFetching, pendingTitleRows,
        refetchAll, refetchManga, registerScrollParent, registerSentinel,
    } = useLibraryMangaAccumulator(
        hasValidId && libraryId !== undefined ? libraryId : undefined,
        Boolean(library),
    );
    useEffect(() => { registerScrollParent(scrollViewportRef.current); }, [registerScrollParent]);
    useEffect(() => { registerSentinel(sentinelRef.current); }, [registerSentinel, hasMore]);

    // Filter manga to only show those from current library
    const manga = useMemo((): MangaWithRelations[] => {
        if (!allManga.length || !library)
            return [];
        return (allManga as MangaWithRelations[]).filter((m) => {
            if (typeof m !== 'object' || m === null) return false;
            return 'libraryId' in m && m.libraryId === library["id"];
        });
    }, [allManga, library]);
    // Calculate filtered and sorted manga
    const displayedManga = useMemo(() => {
        if (!manga)
            return [];
        const effectiveFilter = comicbookTrackingEnabled ? mediaTypeFilter : 'all';
        const mediaFiltered = effectiveFilter === 'all'
            ? manga
            : (manga as MangaWithRelations[]).filter((m) => {
                const mt = (m as { mediaType?: string }).mediaType ?? 'MANGA';
                return effectiveFilter === 'manga' ? mt === 'MANGA' : mt === 'COMICBOOK';
            });
        return filterAndSortManga(mediaFiltered as MangaWithRelations[], {
            sortBy,
            filterBy,
            searchQuery,
            searchField,
            enableRegexSearch,
            advancedFilters
        });
    }, [manga, mediaTypeFilter, comicbookTrackingEnabled, sortBy, filterBy, searchQuery, searchField, enableRegexSearch, advancedFilters]);
    // Get available genres and tags for filters
    const availableGenres = useMemo(() => {
        return getAvailableGenres((manga as MangaWithRelations[]) ?? []);
    }, [manga]);
    const availableTags = useMemo(() => {
        return getAvailableTags((manga as MangaWithRelations[]) ?? []);
    }, [manga]);
    // Refresh handler
    const handleRefresh = async (): Promise<void> => {
        setRefreshing(true);
        try {
            await refreshLibrary();
            await refetchAll();
            showSuccess({
                title: 'Library refreshed successfully',
                message: 'All manga in the library have been updated.'
            });
        }
        catch (_error: unknown) {
            showError({
                title: 'Failed to refresh library',
                message: 'An errorMessage occurred while refreshing the library. Please try again.'
            });
        }
        finally {
            setRefreshing(false);
        }
    };
    // Handle library deletion
    const handleDeleteLibrary = async (): Promise<void> => {
        if (!library || !libraryId)
            return;
        try {
            await deleteLibraryMutation.mutateAsync({
                id: libraryId
            });
            showSuccess({
                title: 'Library Deleted',
                message: `Successfully deleted library ${library["name"]}`
            });
            setTimeout(() => {
                void navigateTo('/');
            }, 500);
        }
        catch (error: unknown) {
            showError({
                title: 'Deletion Failed',
                message: error instanceof Error ? error.message : 'Failed to delete library'
            });
        }
    };
    // Bulk action handlers
    const handleBulkRefresh = async (): Promise<void> => {
        try {
            const result = await bulkRefreshMutation.mutateAsync({
                mangaIds: selectedItems.map(id => Number(id))
            });
            showSuccess({
                title: 'Metadata Refresh Queued',
                message: result.message
            });
            clearSelection();
            setSelectionMode(false);
        } catch (error: unknown) {
            showError({
                title: 'Bulk Refresh Failed',
                message: error instanceof Error ? error.message : 'Failed to queue metadata refresh'
            });
        }
    };

    const handleBulkDelete = async (deleteFiles: boolean): Promise<void> => {
        const count = selectedItems.length;
        const mangaIds = selectedItems.map(id => Number(id));
        await withRemovalToast(
            {
                id: 'bulk-remove-manga',
                processingTitle: 'Removing manga',
                processingMessage: `Removing ${count} manga…`,
                successTitle: 'Bulk Delete Complete',
                successMessage: `${count} manga removed${deleteFiles ? ' along with their files' : ''}`,
                errorTitle: 'Bulk Delete Failed',
                fallbackErrorMessage: 'Failed to delete manga',
            },
            async () => {
                await bulkDeleteMutation.mutateAsync({ mangaIds, deleteFiles });
                // refetchAll refreshes BOTH the paginated query and listTitlesByLibrary,
                // so removed manga leave no ghost skeleton placeholders.
                await refetchAll();
                clearSelection();
                setSelectionMode(false);
            },
        );
    };

    const handleBulkMonitor = async (monitored: boolean): Promise<void> => {
        try {
            const result = await bulkMonitorMutation.mutateAsync({
                mangaIds: selectedItems.map(id => Number(id)),
                monitored
            });
            showSuccess({
                title: 'Monitoring Updated',
                message: `Updated ${result.totalUpdated} chapters across ${result.mangaCount} manga`
            });
            clearSelection();
            setSelectionMode(false);
        } catch (error: unknown) {
            showError({
                title: 'Monitoring Update Failed',
                message: error instanceof Error ? error.message : 'Failed to update monitoring'
            });
            throw error;
        }
    };

    // Loading state
    if (!router.isReady || hasValidId && isLoading) {
        return <Center style={{
                height: "calc(100vh - 88px)",
                paddingTop: 20
            }}>
        <Loader size="xl"/>
      </Center>;
    }
    // Error state
    if (!hasValidId || error) {
        return <Center style={{
                height: "calc(100vh - 88px)",
                paddingTop: 20
            }}>
        <Stack align="center" gap="md">
          <Text size="xl" fw={500} c="dimmed">
            {!hasValidId ? 'Invalid library ID' : 'Failed to load library'}
          </Text>
          {error && <Text size="sm" c="dimmed">
              {(error instanceof Error ? error.message : String(error))}
            </Text>}
          <Button onClick={() => { void navigateTo('/'); }}>
            Go to Home
          </Button>
        </Stack>
      </Center>;
    }
    // Active filter count
    const activeFilterCount = filterBy.length + Object.keys(advancedFilters).filter(k => advancedFilters[k as keyof typeof advancedFilters] !== null).length;
    return <Box style={{
            position: 'relative'
        }}>
      {/* Library Header */}
      <Box p="md" style={{
            borderBottom: '1px solid var(--mantine-color-dark-5)'
        }}>
        <Container size="xl">
          <Group justify="space-between" mb="md">
            <Group>
              <Tooltip label="Back to Libraries">
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => { void navigateTo('/library'); }}
                >
                  <IconArrowLeft size={20} />
                </ActionIcon>
              </Tooltip>
              <Title order={2}>{library?.name ?? 'Library'}</Title>
              <Badge variant="light" size="lg">
                {displayedManga.length}{hasMore ? '+' : ''} / {manga?.length ?? 0}{hasMore ? '+' : ''} manga
              </Badge>
            </Group>
            
            <Group>
              {/* Selection Mode Controls */}
              {selectionMode && selectedItems.length > 0 && (
                <Group gap="xs">
                  <Badge size="lg" variant="filled" color="blue">
                    {selectedItems.length} selected
                  </Badge>
                  <Tooltip label="Refresh Metadata">
                    <Button
                      variant="light"
                      leftSection={<IconRefresh size={16}/>}
                      onClick={() => { void handleBulkRefresh(); }}
                      loading={bulkRefreshMutation.isPending}
                    >
                      Refresh
                    </Button>
                  </Tooltip>
                  <Tooltip label="Toggle Monitoring">
                    <Button
                      variant="light"
                      leftSection={<IconEye size={16}/>}
                      onClick={() => setBulkMonitorModalOpened(true)}
                    >
                      Monitor
                    </Button>
                  </Tooltip>
                  <Tooltip label="Delete Selected">
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={16}/>}
                      onClick={() => setBulkDeleteModalOpened(true)}
                    >
                      Delete
                    </Button>
                  </Tooltip>
                </Group>
              )}

              {selectionMode && (
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => selectAll(manga.map(m => String(m.id)))}
                  >
                    Select All ({manga?.length ?? 0})
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={clearSelection}
                  >
                    Deselect All
                  </Button>
                </Group>
              )}

              <Button
                variant={selectionMode ? 'filled' : 'light'}
                leftSection={<IconCircleCheck size={16}/>}
                onClick={() => setSelectionMode(!selectionMode)}
              >
                {selectionMode ? 'Cancel' : 'Select'}
              </Button>

              {comicbookTrackingEnabled && (
                <SegmentedControl
                  size="sm"
                  value={mediaTypeFilter}
                  onChange={(v) => setMediaTypeFilter(v as 'all' | 'manga' | 'comicbook')}
                  data={[
                    { label: 'All', value: 'all' },
                    { label: 'Manga', value: 'manga' },
                    { label: 'Comics', value: 'comicbook' },
                  ]}
                />
              )}

              <Button
                variant="light"
                leftSection={<IconFilter size={16}/>}
                onClick={() => setAdvancedFiltersOpened(true)}
                rightSection={activeFilterCount > 0 &&
                  <Badge size="sm" variant="filled" color="blue">
                    {activeFilterCount}
                  </Badge>
                }
              >
                Advanced Filters
              </Button>

              <ActionIcon variant="light" size="lg" onClick={() => { void handleRefresh(); }} title="Refresh library" loading={refreshing}>
                <IconRefresh size={18}/>
              </ActionIcon>

              <Menu width={200} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="light" size="lg">
                    <IconDotsVertical size={18}/>
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconEdit size={14}/>} onClick={() => setEditModalOpened(true)}>
                    Edit Library
                  </Menu.Item>
                  <Menu.Item leftSection={<IconPlus size={14}/>} onClick={() => setAddMangaModalOpened(true)}>
                    Add Manga
                  </Menu.Item>
                  {comicbookTrackingEnabled && (
                    <Menu.Item leftSection={<IconBook size={14}/>} onClick={() => { void router.push(`/add-comic?libraryId=${libraryId ?? ''}`); }}>
                      Add Comicbook
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconTrash size={14}/>} color="red" onClick={() => setDeleteModalOpened(true)}>
                    Delete Library
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Main Content Area with Alphabet Navigation */}
      <Box style={{
            display: 'flex',
            height: 'calc(100vh - 200px)'
        }}>
        {/* Scrollable Content */}
        <ScrollArea viewportRef={scrollViewportRef} style={{
            flex: 1
        }}>
          <Container size="xl" p="md">
            {/* Always show LibraryContent to ensure Add Manga card is visible */}
            {displayedManga.length === 0 && (searchQuery || filterBy.length > 0 || activeFilterCount > 0) ? (
              // Show filter message when filters are active but no results
              <Stack gap="xl">
                <Center style={{ minHeight: 200 }}>
                  <Stack align="center" gap="md">
                    <Text size="xl" fw={500} c="dimmed">
                      No manga match your filters
                    </Text>
                    <Text size="sm" c="dimmed">
                      Try adjusting your search or filters
                    </Text>
                    <Button variant="light" onClick={() => {
                      useLibraryViewStore.getState().resetFilters();
                    }}>
                      Clear Filters
                    </Button>
                  </Stack>
                </Center>
              </Stack>
            ) : (
              // Show all manga in a single grid without alphabetical grouping
              <>
                <LibraryContent
                  manga={displayedManga as MangaWithRelations[]}
                  libraryId={libraryId ?? 0}
                  onRefresh={async () => { await Promise.all([refreshLibrary(), refetchAll()]); }}
                  scrollParentRef={scrollViewportRef}
                />
                {hasMore && (
                  <Box ref={sentinelRef} style={{ minHeight: 1 }} />
                )}
                {(() => {
                  const loadedIds = new Set(manga.map(m => m.id));
                  const titles = (pendingTitleRows ?? []).filter(r => !loadedIds.has(r.id)).map(r => r.title);
                  // Generic 12-skeleton fallback only on the initial empty load — not on
                  // a refetch (e.g. after a removal), where it flashed ghost cards.
                  const count = titles.length > 0 ? titles.length : (isFetching && hasMore && manga.length === 0 ? 12 : 0);
                  return count > 0 ? <MangaCardSkeletonGrid count={count} coverSize={coverSize} titles={titles} /> : null;
                })()}
              </>
            )}
          </Container>
        </ScrollArea>
        
      </Box>
      
      {/* Modals */}
      {library && <>
          <EditLibraryModal opened={editModalOpened} onClose={() => setEditModalOpened(false)} library={library ? {
                id: typeof library["id"] === 'string' ? toNumberId(library["id"]) : library["id"],
                name: library["name"],
                path: library.path
            } : {
                id: 0,
                name: '',
                path: ''
            }}/>

          
          <Modal opened={deleteModalOpened} onClose={() => setDeleteModalOpened(false)} title="Delete Library" centered>

            <Stack gap="md">
              <Text>
                Are you sure you want to delete the library &quot;{library["name"]}&quot;?
                This action cannot be undone.
              </Text>
              <Text size="sm" c="dimmed">
                All manga in this library will be removed from your collection.
              </Text>
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setDeleteModalOpened(false)}>
                  Cancel
                </Button>
                <Button color="red" onClick={() => { void handleDeleteLibrary(); }} loading={deleteLibraryMutation.isPending}>

                  Delete Library
                </Button>
              </Group>
            </Stack>
          </Modal>
          
          <AdvancedFilters opened={advancedFiltersOpened} onClose={() => setAdvancedFiltersOpened(false)} availableGenres={availableGenres} availableTags={availableTags}/>

          
          {/* Add Manga Modal */}
          {libraryId && <AddMangaModal opened={addMangaModalOpened} onClose={() => setAddMangaModalOpened(false)} libraryId={libraryId} onComplete={(_mangaId) => {
                    // Close modal FIRST to prevent re-open
                    setAddMangaModalOpened(false);
                    // Defer library refresh to next tick to avoid render race conditions
                    setTimeout(() => {
                      void refreshLibrary();
                      // Also refetch manga query to show newly imported manga
                      void refetchManga();
                    }, 0);
                }}/>}

          {/* Bulk Action Modals */}
          <BulkDeleteModal
            opened={bulkDeleteModalOpened}
            onClose={() => setBulkDeleteModalOpened(false)}
            onConfirm={handleBulkDelete}
            selectedCount={selectedItems.length}
          />
          <BulkMonitorModal
            opened={bulkMonitorModalOpened}
            onClose={() => setBulkMonitorModalOpened(false)}
            onConfirm={handleBulkMonitor}
            selectedCount={selectedItems.length}
          />
        </>}
    </Box>;
}
LibraryPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
    return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
export default LibraryPage;
