/**
 * BulkActionsModal component for performing bulk operations on manga
 *
 * This component provides a modal interface for selecting and performing
 * bulk actions on multiple manga items within a library.
 */
import React, { useState, useCallback, useMemo } from 'react';

import { Modal, ScrollArea, Table, Checkbox, Button, Group, Text, Stack, Divider, Badge, Menu, ActionIcon, Select, LoadingOverlay } from '@mantine/core';
import { modals } from '@mantine/modals';
import { MangaPublicationStatus, MangaLibraryStatus, ChapterStatus } from '@prisma/client';
import { IconBook, IconDownload, IconTrash, IconRefresh, IconDotsVertical, } from '@tabler/icons-react';

import { useLibraryViewStore } from '@/store/index';
import { ValidationError } from '@/utils/errors';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';
import { isRecord } from '@/utils/type-guards/index';


import type { Prisma } from '@prisma/client';
// Use Prisma's generated type with relations
type MangaWithRelations = Prisma.MangaGetPayload<{
    include: {
        Metadata: true;
        Chapter: true;
    };
}>;
interface BulkActionsModalProps {
    opened: boolean;
    onClose: () => void;
    libraryId: number;
    mangaList: MangaWithRelations[];
}
type BulkAction = 'mark-read' | 'mark-unread' | 'download' | 'remove' | 'update-metadata' | 'change-status';
 
export function BulkActionsModal({ opened, onClose, mangaList }: BulkActionsModalProps): React.ReactElement | null {
    const selectedItems = useLibraryViewStore(state => state.selectedItems);
    const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);
    const clearSelection = useLibraryViewStore(state => state.clearSelection);
    const selectAll = useLibraryViewStore(state => state.selectAll);
    const [isLoading, setIsLoading] = useState(false);
    const [actionInProgress, setActionInProgress] = useState<BulkAction | null>(null);
    const [statusToApply, setStatusToApply] = useState<MangaLibraryStatus>(MangaLibraryStatus.READING);
    // Get bulk mutations
    const bulkOperationMutation = trpc.bulk.performBulkAction.useMutation();
    const markChaptersMutation = trpc.bulk.markChapters.useMutation();
    const changeStatusMutation = trpc.bulk.changeStatus.useMutation();
    const queueDownloadsMutation = trpc.bulk.queueDownloads.useMutation();
    const removeMangaMutation = trpc.bulk.removeManga.useMutation();
    // Filter manga list to only selected items
    const selectedManga = useMemo(() => {
        return mangaList.filter(manga => selectedItems.includes(toStringId(manga["id"])));
    }, [mangaList, selectedItems]);
    // Check if all items are selected
    const allSelected = mangaList.length > 0 && mangaList.every(manga => selectedItems.includes(toStringId(manga["id"])));
    const someSelected = mangaList.some(manga => selectedItems.includes(toStringId(manga["id"])));
    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            clearSelection();
        }
        else {
            const allIds = mangaList.map(manga => toStringId(manga["id"]));
            selectAll(allIds);
        }
    }, [allSelected, mangaList, clearSelection, selectAll]);
    const handleSelectItem = useCallback((mangaId: string) => {
        toggleItemSelection(mangaId);
    }, [toggleItemSelection]);
    const getReadProgress = useCallback((manga: MangaWithRelations): string => {
        const chapters = manga.Chapter;
        const readChapters = chapters.filter(ch => ch.isRead).length;
        const totalChapters = chapters.length;
        if (totalChapters === 0)
            return '0/0';
        return `${readChapters}/${totalChapters}`;
    }, []);
    const getDownloadProgress = useCallback((manga: MangaWithRelations): string => {
        const chapters = manga.Chapter;
        const downloadedChapters = chapters.filter(ch => ch.downloadStatus === ChapterStatus.COMPLETED).length;
        const totalChapters = chapters.length;
        if (totalChapters === 0)
            return '0/0';
        return `${downloadedChapters}/${totalChapters}`;
    }, []);
    const getStatusBadge = useCallback((status?: MangaPublicationStatus) => {
        const statusColors: Record<MangaPublicationStatus, string> = {
            [MangaPublicationStatus.ONGOING]: 'blue',
            [MangaPublicationStatus.COMPLETED]: 'green',
            [MangaPublicationStatus.CANCELLED]: 'red',
            [MangaPublicationStatus.HIATUS]: 'yellow',
            [MangaPublicationStatus.NOT_YET_PUBLISHED]: 'violet',
            [MangaPublicationStatus.NOT_YET_RELEASED]: 'indigo',
            [MangaPublicationStatus.UPCOMING]: 'purple',
            [MangaPublicationStatus.UNKNOWN]: 'gray'
        };
        const displayStatus = status ?? MangaPublicationStatus.UNKNOWN;
        const displayLabel = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
        return <Badge color={statusColors[displayStatus]} size="sm">
        {displayLabel}
      </Badge>;
    }, []);
    /**
     * Run a bulk action against an explicit set of manga IDs. Used by both the
     * top-of-modal multi-select buttons (passing the current Zustand selection)
     * and the per-row context menu (passing a single manga's id directly —
     * critical: do NOT route the per-row case through Zustand's `selectAll`
     * because the closure captures stale `selectedManga` and would mutate the
     * wrong rows).
     */
    const runActionForIds = useCallback(async (action: BulkAction, ids: number[], additionalData?: unknown): Promise<void> => {
        if (ids.length === 0) {
            notify({ severity: 'WARNING', title: 'No Selection', message: 'Please select manga to perform bulk actions' });
            return;
        }
        setIsLoading(true);
        setActionInProgress(action);
        try {
            const selectedIds = ids;
            let result;
            switch (action) {
                case 'mark-read':
                    result = await markChaptersMutation.mutateAsync({
                        mangaIds: selectedIds,
                        isRead: true
                    });
                    break;
                case 'mark-unread':
                    result = await markChaptersMutation.mutateAsync({
                        mangaIds: selectedIds,
                        isRead: false
                    });
                    break;
                case 'download':
                    result = await queueDownloadsMutation.mutateAsync({
                        mangaIds: selectedIds,
                        chapterSelection: 'unread' // Default to unread chapters
                    });
                    break;
                case 'remove': {
                    // Confirm before removing — Mantine modal preserves UX consistency
                    // with the rest of the app and is mobile-safe.
                    const confirmed = await new Promise<boolean>((resolve) => {
                        modals.openConfirmModal({
                            title: 'Remove from library',
                            centered: true,
                            children: (
                                <Text size="sm">
                                    Remove <Text span fw={600}>{ids.length}</Text> manga from your library? This action cannot be undone.
                                </Text>
                            ),
                            labels: { confirm: 'Remove', cancel: 'Cancel' },
                            confirmProps: { color: 'red' },
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                            onClose: () => resolve(false),
                        });
                    });
                    if (!confirmed) {
                        setIsLoading(false);
                        setActionInProgress(null);
                        return;
                    }
                    result = await removeMangaMutation.mutateAsync({
                        mangaIds: selectedIds
                    });
                    break;
                }
                case 'update-metadata':
                    result = await bulkOperationMutation.mutateAsync({
                        mangaIds: selectedIds,
                        operation: 'update-metadata'
                    });
                    break;
                case 'change-status': {
                    // Change status for selected manga. Validate the payload's status
                    // value against the enum rather than blind-casting.
                    const rawStatus = isRecord(additionalData) ? additionalData["status"] : undefined;
                    const validStatuses = Object.values(MangaLibraryStatus) as string[];
                    if (typeof rawStatus !== 'string' || !validStatuses.includes(rawStatus)) {
                        notify({ severity: 'WARNING', title: 'No Status Selected', message: 'Please select a valid status to apply' });
                        setIsLoading(false);
                        setActionInProgress(null);
                        return;
                    }
                    result = await changeStatusMutation.mutateAsync({
                        mangaIds: selectedIds,
                        status: rawStatus as MangaLibraryStatus
                    });
                    break;
                }
                default: throw new ValidationError(`Unknown action: ${action}`);
            }
            // Show result notification
            if (result.success) {
                notify({ severity: 'SUCCESS', title: 'Bulk Action Complete', message: result.message });
                // Clear selection after successful bulk action
                clearSelection();
            }
            else {
                notify({ severity: 'ERROR', title: 'Action Failed', message: result.message });
            }
        }
        catch (error: unknown) {
            notify({ severity: 'ERROR', title: 'Bulk Action Failed', message: error instanceof Error ? error.message : 'An unknown error occurred' });
        }
        finally {
            setIsLoading(false);
            setActionInProgress(null);
        }
    }, [bulkOperationMutation, markChaptersMutation, changeStatusMutation, queueDownloadsMutation, removeMangaMutation, clearSelection]);

    /**
     * Top-of-modal multi-select buttons. Operates on whatever the user has selected
     * via the table checkboxes (Zustand store).
     */
    const handleBulkAction = useCallback((action: BulkAction, additionalData?: unknown): Promise<void> => {
        const ids = selectedManga.map(manga => toNumberId(manga["id"]));
        return runActionForIds(action, ids, additionalData);
    }, [selectedManga, runActionForIds]);

    /**
     * Per-row context-menu actions. Bypasses the Zustand selection store entirely
     * to avoid the stale-closure clobber bug — passes the row's id directly.
     */
    const handleSingleAction = useCallback((mangaId: number, action: BulkAction): Promise<void> => {
        return runActionForIds(action, [mangaId]);
    }, [runActionForIds]);
    return <Modal opened={opened} onClose={() => { void onClose(); }} title="Bulk Actions" size="xl" closeOnClickOutside={!isLoading} closeOnEscape={!isLoading}>

      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select manga to perform bulk actions. {selectedManga.length} of {mangaList.length} selected.
        </Text>
        
        <Divider />
        
        {/* Action Buttons */}
        <Group gap="sm">
          <Button leftSection={<IconBook size={16}/>} variant="light" size="sm" onClick={() => { void handleBulkAction('mark-read'); }} disabled={selectedManga.length === 0 || isLoading} loading={actionInProgress === 'mark-read'}>

            Mark as Read
          </Button>
          
          <Button leftSection={<IconBook size={16}/>} variant="light" size="sm" onClick={() => { void handleBulkAction('mark-unread'); }} disabled={selectedManga.length === 0 || isLoading} loading={actionInProgress === 'mark-unread'}>

          Mark as Unread
          </Button>
          
          <Button leftSection={<IconDownload size={16}/>} variant="light" size="sm" onClick={() => { void handleBulkAction('download'); }} disabled={selectedManga.length === 0 || isLoading} loading={actionInProgress === 'download'}>

            Queue Download
          </Button>
          
          <Button leftSection={<IconRefresh size={16}/>} variant="light" size="sm" onClick={() => { void handleBulkAction('update-metadata'); }} disabled={selectedManga.length === 0 || isLoading} loading={actionInProgress === 'update-metadata'}>

            Update Metadata
          </Button>
          
          <Group gap="xs">
            <Select size="sm" placeholder="Change status..." data={[{
                value: MangaLibraryStatus.READING,
                label: 'Reading'
            }, {
                value: MangaLibraryStatus.COMPLETED,
                label: 'Completed'
            }, {
                value: MangaLibraryStatus.ON_HOLD,
                label: 'On Hold'
            }, {
                value: MangaLibraryStatus.DROPPED,
                label: 'Dropped'
            }, {
                value: MangaLibraryStatus.PLAN_TO_READ,
                label: 'Plan to Read'
            }, {
                value: MangaLibraryStatus.ARCHIVED,
                label: 'Archived'
            }]} value={statusToApply} onChange={value => setStatusToApply(value as MangaLibraryStatus)} disabled={selectedManga.length === 0 || isLoading} w={150}/>

            <Button leftSection={<IconRefresh size={16}/>} variant="light" size="sm" onClick={() => { void handleBulkAction('change-status', {
            status: statusToApply
        }); }} disabled={selectedManga.length === 0 || isLoading} loading={actionInProgress === 'change-status'}>

              Apply
            </Button>
          </Group>
          
          <Button leftSection={<IconTrash size={16}/>} variant="light" color="red" size="sm" onClick={() => { void handleBulkAction('remove'); }} disabled={selectedManga.length === 0 || isLoading} loading={actionInProgress === 'remove'} ml="auto">

            Remove from Library
          </Button>
        </Group>
        
        <Divider />
        
        {/* Manga Table */}
        <ScrollArea style={{
            height: 400
        }} pos="relative">
          <LoadingOverlay visible={isLoading}/>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={50}>
                  <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={() => { void handleSelectAll(); }}/>

                </Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Progress</Table.Th>
                <Table.Th>Downloaded</Table.Th>
                <Table.Th w={50}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {mangaList.map(manga => <Table.Tr key={manga["id"]}>
                  <Table.Td>
                    <Checkbox checked={selectedItems.includes(toStringId(manga["id"]))} onChange={() => { void handleSelectItem(toStringId(manga["id"])); }}/>

                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {manga["title"]}
                    </Text>
                  </Table.Td>
                  <Table.Td>{getStatusBadge(manga.publicationStatus)}</Table.Td>
                  <Table.Td>{getReadProgress(manga)}</Table.Td>
                  <Table.Td>{getDownloadProgress(manga)}</Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="sm">
                          <IconDotsVertical size={16}/>
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconBook size={14}/>} onClick={() => {
                void handleSingleAction(toNumberId(manga["id"]), 'mark-read');
            }}>

                          Mark as Read
                        </Menu.Item>
                        <Menu.Item leftSection={<IconDownload size={14}/>} onClick={() => {
                void handleSingleAction(toNumberId(manga["id"]), 'download');
            }}>

                          Download
                        </Menu.Item>
                        <Menu.Item leftSection={<IconRefresh size={14}/>} onClick={() => {
                void handleSingleAction(toNumberId(manga["id"]), 'update-metadata');
            }}>

                          Update Metadata
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>)}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        
        {/* Footer */}
        <Group gap="sm" justify="flex-end">
          <Button variant="outline" onClick={() => { void onClose(); }} disabled={isLoading}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>;
}
