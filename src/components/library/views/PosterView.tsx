/**
 * Poster View Component
 *
 * Virtualized grid of manga poster cards. Row-level virtualization via
 * @tanstack/react-virtual keeps the mounted-card count bounded regardless of
 * library size, which fixes scroll jank on 200+ item libraries and makes the
 * alphabet jump bar responsive by jumping straight to the target row instead
 * of waiting for every preceding card to paint.
 *
 * @module components/library/views/PosterView
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Box, Center, Stack, Text, Checkbox } from '@mantine/core';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';

import { CardAddMangaButton } from '@/components/addManga/CardAddMangaButton';
import { ResponsiveMangaCard } from '@/components/responsive/ResponsiveMangaCard';
import { useBreakpoint } from '@/hooks/mobile';
import { useNavigation } from '@/hooks/useNavigation';
import { useLibraryViewStore } from '@/store/index';
import type { MangaWithRelations } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { withRemovalToast } from '@/utils/removalToast';
import { trpc } from '@/utils/trpc-client/index';

import { filterAndSortManga } from '../utils/libraryUtils';

interface PosterViewProps {
    manga: MangaWithRelations[];
    libraryId: number;
    /** Refreshes the library data. Returns a promise so callers (e.g. remove)
     *  can await the list actually settling before reporting success. */
    onRefresh: () => void | Promise<void>;
    /** ScrollArea viewport ref from parent page — required for virtualization. */
    scrollParentRef?: React.RefObject<HTMLElement | null>;
}

interface RowRenderContext {
    displayedManga: MangaWithRelations[];
    columnsPerRow: number;
    totalCells: number;
    selectionMode: boolean;
    selectedItems: string[];
    toggleItemSelection: (id: string) => void;
    onMangaClick: (id: number | string) => void;
    onMangaRemove: (id: number, shouldRemoveFiles: boolean) => void;
    onMangaPrefetch: (id: number | string) => void;
    onRefresh: () => void;
    libraryId: number;
}

// Column counts mirror the prior Mantine Grid breakpoints (`base/sm/md/lg`)
// so layout matches the non-virtualized version at every width.
function getColumnsPerRow(width: number, coverSize: string): number {
    if (width >= 1200) {
        if (coverSize === 'small') return 6;
        if (coverSize === 'large') return 3;
        return 4;
    }
    if (width >= 992) {
        if (coverSize === 'small') return 4;
        if (coverSize === 'large') return 2;
        return 3;
    }
    if (width >= 768) {
        if (coverSize === 'small') return 3;
        if (coverSize === 'large') return 1;
        return 2;
    }
    if (width >= 576) {
        if (coverSize === 'small') return 2;
        return 1;
    }
    return coverSize === 'small' ? 2 : 1;
}

function useViewportWidth(): number {
    const [width, setWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onResize = (): void => setWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return width;
}

function findLetterIndex(manga: MangaWithRelations[], letter: string): number {
    return manga.findIndex((m) => {
        const firstChar = m.title.charAt(0).toUpperCase();
        if (letter === '#') return firstChar === '' || !/[A-Z]/.test(firstChar);
        return firstChar === letter;
    });
}

function useJumpToLetter(
    virtualizer: Virtualizer<HTMLElement, Element>,
    displayedManga: MangaWithRelations[],
    columnsPerRow: number,
): void {
    // Remember the most recent jump target so we can re-scroll once pagination
    // loads the matching title. Without this, clicking "P" before P-titles have
    // paginated in is silently a no-op.
    const pendingLetterRef = useRef<string | null>(null);

    const scrollToLetter = useCallback((letter: string): boolean => {
        const idx = findLetterIndex(displayedManga, letter);
        if (idx === -1) return false;
        const cellIndex = idx + 1; // +1 for Add Manga card
        const rowIndex = Math.floor(cellIndex / columnsPerRow);
        virtualizer.scrollToIndex(rowIndex, { align: 'start' });
        return true;
    }, [displayedManga, columnsPerRow, virtualizer]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = (event: Event): void => {
            const detail = (event as CustomEvent).detail as { letter?: string } | undefined;
            const letter = detail?.letter;
            if (!letter) return;
            const hit = scrollToLetter(letter);
            pendingLetterRef.current = hit ? null : letter;
        };
        window.addEventListener('library-jump', handler as EventListener);
        return () => window.removeEventListener('library-jump', handler as EventListener);
    }, [scrollToLetter]);

    // When pagination extends the list, retry any pending jump.
    useEffect(() => {
        const letter = pendingLetterRef.current;
        if (!letter) return;
        if (scrollToLetter(letter)) pendingLetterRef.current = null;
    }, [scrollToLetter]);
}

function SelectionCheckbox({ mangaId, selected, onToggle }: { mangaId: string; selected: boolean; onToggle: (id: string) => void }): React.ReactElement {
    return (
        <Checkbox
            checked={selected}
            onChange={() => onToggle(mangaId)}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}
            styles={{
                input: {
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                },
            }}
        />
    );
}

const MangaCell = React.memo(function MangaCell({ manga, ctx }: { manga: MangaWithRelations; ctx: RowRenderContext }): React.ReactElement | null {
    if (!manga.id) return null;
    const idNum = typeof manga.id === 'string' ? toNumberId(manga.id) : manga.id;
    const idStr = String(manga.id);
    const prefetch = (): void => { ctx.onMangaPrefetch(manga.id); };
    return (
        <Box
            data-manga-title={manga.title}
            style={{ minWidth: 0, position: 'relative' }}
            onMouseEnter={prefetch}
            onFocus={prefetch}
        >
            {ctx.selectionMode && (
                <SelectionCheckbox mangaId={idStr} selected={ctx.selectedItems.includes(idStr)} onToggle={ctx.toggleItemSelection} />
            )}
            <ResponsiveMangaCard
                manga={{ ...manga, chapters: manga.Chapter } as MangaWithRelations}
                onRefresh={ctx.onRefresh}
                onUpdate={ctx.onRefresh}
                showMobileActions={false}
                onRemove={(shouldRemoveFiles: boolean) => { ctx.onMangaRemove(idNum, shouldRemoveFiles); }}
                onClick={() => { ctx.onMangaClick(manga.id); }}
            />
        </Box>
    );
});

function buildRowCells(rowIndex: number, ctx: RowRenderContext): React.ReactNode[] {
    const cells: React.ReactNode[] = [];
    const rowStart = rowIndex * ctx.columnsPerRow;
    for (let col = 0; col < ctx.columnsPerRow; col++) {
        const cellIndex = rowStart + col;
        if (cellIndex >= ctx.totalCells) break;
        if (cellIndex === 0) {
            cells.push(
                <Box key="add-manga" style={{ minWidth: 0 }}>
                    <CardAddMangaButton libraryId={ctx.libraryId} onAdd={ctx.onRefresh} />
                </Box>
            );
            continue;
        }
        const m = ctx.displayedManga[cellIndex - 1];
        if (!m?.id) continue;
        cells.push(<MangaCell key={m.id} manga={m} ctx={ctx} />);
    }
    return cells;
}

function EmptyFiltersState(): React.ReactElement {
    return (
        <Center p="xl">
            <Stack align="center" gap="md">
                <Text size="lg" c="dimmed">No manga match your filters</Text>
                <Text size="sm" c="dimmed">Try adjusting your search criteria</Text>
            </Stack>
        </Center>
    );
}

const GUTTER_PX = 16;

export function PosterView({ manga, libraryId, onRefresh, scrollParentRef }: PosterViewProps): React.ReactElement {
    const { navigateTo, prefetch } = useNavigation();
    // Manga removal uses a Mantine loading→success toast plus a durable bell row;
    // see handleMangaRemove below.
    const { isMobile, isTablet } = useBreakpoint();
    const sortBy = useLibraryViewStore(state => state.sortBy);
    const filterBy = useLibraryViewStore(state => state.filterBy);
    const searchQuery = useLibraryViewStore(state => state.searchQuery);
    const searchField = useLibraryViewStore(state => state.searchField);
    const enableRegexSearch = useLibraryViewStore(state => state.enableRegexSearch);
    const advancedFilters = useLibraryViewStore(state => state.advancedFilters);
    const coverSize = useLibraryViewStore(state => state.coverSize);
    const selectionMode = useLibraryViewStore(state => state.selectionMode);
    const selectedItems = useLibraryViewStore(state => state.selectedItems);
    const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);

    // Toasts + refetch are orchestrated in handleMangaRemove so the success
    // notification fires only AFTER the list has actually refetched.
    const removeMangaMutation = trpc.manga.remove.useMutation();

    const displayedManga = useMemo(() => {
        const filtered = filterAndSortManga(manga, {
            sortBy, filterBy, searchQuery, searchField, enableRegexSearch, advancedFilters,
        });
        return filtered as MangaWithRelations[];
    }, [manga, searchQuery, searchField, enableRegexSearch, advancedFilters, filterBy, sortBy]);

    const viewportWidth = useViewportWidth();
    const columnsPerRow = useMemo(() => getColumnsPerRow(viewportWidth, coverSize), [viewportWidth, coverSize]);

    const totalCells = displayedManga.length + 1;
    const rowCount = Math.ceil(totalCells / columnsPerRow);
    const estimatedRowHeight = isMobile ? 290 : isTablet ? 340 : 380;

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => scrollParentRef?.current ?? null,
        estimateSize: () => estimatedRowHeight,
        overscan: 3,
    });

    useJumpToLetter(virtualizer, displayedManga, columnsPerRow);

    // Refs stabilize the parent's inline callbacks so `ctx` stays referentially
    // stable across scroll-driven re-renders — which is what lets React.memo
    // on MangaCell actually skip work.
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;
    const stableOnRefresh = useCallback(() => { void onRefreshRef.current(); }, []);

    // Latest manga list, read inside the (otherwise stable) remove handler to
    // resolve the removed title for the notification without re-creating it.
    const mangaRef = useRef(manga);
    mangaRef.current = manga;

    const prefetchRef = useRef(prefetch);
    prefetchRef.current = prefetch;

    const selectionModeRef = useRef(selectionMode);
    selectionModeRef.current = selectionMode;

    const handleMangaClick = useCallback((id: number | string) => {
        if (selectionModeRef.current) {
            toggleItemSelection(String(id));
            return;
        }
        void navigateTo(`/manga/${id}`, { skipIfSame: false });
    }, [navigateTo, toggleItemSelection]);

    const handleMangaPrefetch = useCallback((id: number | string) => {
        prefetchRef.current(`/manga/${id}`);
    }, []);

    const handleMangaRemove = useCallback((id: number, shouldRemoveFiles: boolean) => {
        void (async () => {
            logger.info(`Library: Removing manga ${id} with shouldRemoveFiles=${shouldRemoveFiles}`);
            const title = mangaRef.current.find(m => toNumberId(m.id) === id)?.title ?? 'manga';
            const filesSuffix = shouldRemoveFiles ? ' along with its files' : '';
            await withRemovalToast(
                {
                    id: `remove-manga-${id}`,
                    processingTitle: 'Removing manga',
                    processingMessage: `Removing “${title}”…`,
                    successTitle: 'Manga Removed',
                    successMessage: `“${title}” was removed${filesSuffix}`,
                    errorTitle: 'Failed to Remove Manga',
                    fallbackErrorMessage: 'An error occurred while removing the manga',
                },
                async () => {
                    await removeMangaMutation.mutateAsync({ id, shouldRemoveFiles });
                    // Wait for the library list to refetch so the card is gone BEFORE
                    // success is reported — the fix for "notify, then UI updates".
                    await onRefreshRef.current();
                },
            ).catch((error: unknown) => {
                logger.error('Failed to remove manga:', error instanceof Error ? error.message : String(error));
            });
        })();
    }, [removeMangaMutation]);

    const ctx: RowRenderContext = useMemo(() => ({
        displayedManga, columnsPerRow, totalCells,
        selectionMode, selectedItems, toggleItemSelection,
        onMangaClick: handleMangaClick,
        onMangaRemove: handleMangaRemove,
        onMangaPrefetch: handleMangaPrefetch,
        onRefresh: stableOnRefresh, libraryId,
    }), [
        displayedManga, columnsPerRow, totalCells,
        selectionMode, selectedItems, toggleItemSelection,
        handleMangaClick, handleMangaRemove, handleMangaPrefetch, stableOnRefresh, libraryId,
    ]);

    if (displayedManga.length === 0 && manga.length > 0) {
        return <EmptyFiltersState />;
    }

    const virtualRows = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();

    return (
        <Box style={{ position: 'relative', width: '100%', height: totalSize }}>
            {virtualRows.map((row) => (
                <div
                    key={row.key}
                    data-index={row.index}
                    ref={virtualizer.measureElement}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${row.start}px)`,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
                        gap: GUTTER_PX,
                        paddingBottom: GUTTER_PX,
                    }}
                >
                    {buildRowCells(row.index, ctx)}
                </div>
            ))}
        </Box>
    );
}
