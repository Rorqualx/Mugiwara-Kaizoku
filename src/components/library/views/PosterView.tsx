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

import { Box, Checkbox } from '@mantine/core';
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

interface PosterViewProps {
    manga: MangaWithRelations[];
    libraryId: number;
    /** Refreshes the library data. Returns a promise so callers (e.g. remove)
     *  can await the list actually settling before reporting success. */
    onRefresh: () => void | Promise<void>;
    /** ScrollArea viewport ref from parent page — required for virtualization. */
    scrollParentRef?: React.RefObject<HTMLElement | null>;
}

/**
 * What every cell shares. Holds only settings and stable callbacks, so it
 * keeps its identity while the grid scrolls; per-cell data (the manga, its
 * selected state) is passed to each cell separately. A context that changed
 * on every render re-rendered every mounted card on every scroll step.
 */
interface CellContext {
    selectionMode: boolean;
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

interface RowLayout {
    displayedManga: MangaWithRelations[];
    columnsPerRow: number;
    totalCells: number;
    selectedItems: string[];
}

const MangaCell = React.memo(function MangaCell({ manga, selected, ctx }: { manga: MangaWithRelations; selected: boolean; ctx: CellContext }): React.ReactElement | null {
    const id = manga.id;
    const cardManga = useMemo(() => ({ ...manga, chapters: manga.Chapter } as MangaWithRelations), [manga]);
    const { onMangaPrefetch, onMangaRemove, onMangaClick } = ctx;
    const prefetch = useCallback((): void => { onMangaPrefetch(id); }, [onMangaPrefetch, id]);
    const handleRemove = useCallback((shouldRemoveFiles: boolean): void => {
        onMangaRemove(typeof id === 'string' ? toNumberId(id) : id, shouldRemoveFiles);
    }, [onMangaRemove, id]);
    const handleClick = useCallback((): void => { onMangaClick(id); }, [onMangaClick, id]);
    if (!id) return null;
    const idStr = String(id);
    return (
        <Box
            data-manga-title={manga.title}
            style={{ minWidth: 0, position: 'relative' }}
            onMouseEnter={prefetch}
            onFocus={prefetch}
        >
            {ctx.selectionMode && (
                <SelectionCheckbox mangaId={idStr} selected={selected} onToggle={ctx.toggleItemSelection} />
            )}
            <ResponsiveMangaCard
                manga={cardManga}
                onRefresh={ctx.onRefresh}
                onUpdate={ctx.onRefresh}
                showMobileActions={false}
                onRemove={handleRemove}
                onClick={handleClick}
            />
        </Box>
    );
});

function buildRowCells(rowIndex: number, layout: RowLayout, ctx: CellContext): React.ReactNode[] {
    const cells: React.ReactNode[] = [];
    const rowStart = rowIndex * layout.columnsPerRow;
    for (let col = 0; col < layout.columnsPerRow; col++) {
        const cellIndex = rowStart + col;
        if (cellIndex >= layout.totalCells) break;
        if (cellIndex === 0) {
            cells.push(
                <Box key="add-manga" style={{ minWidth: 0 }}>
                    <CardAddMangaButton libraryId={ctx.libraryId} onAdd={ctx.onRefresh} />
                </Box>
            );
            continue;
        }
        const m = layout.displayedManga[cellIndex - 1];
        if (!m?.id) continue;
        const selected = ctx.selectionMode && layout.selectedItems.includes(String(m.id));
        cells.push(<MangaCell key={m.id} manga={m} selected={selected} ctx={ctx} />);
    }
    return cells;
}

const GUTTER_PX = 16;

export function PosterView({ manga, libraryId, onRefresh, scrollParentRef }: PosterViewProps): React.ReactElement {
    const { navigateTo, prefetch } = useNavigation();
    // Manga removal uses a Mantine loading→success toast plus a durable bell row;
    // see handleMangaRemove below.
    const { isMobile, isTablet } = useBreakpoint();
    const coverSize = useLibraryViewStore(state => state.coverSize);
    const selectionMode = useLibraryViewStore(state => state.selectionMode);
    const selectedItems = useLibraryViewStore(state => state.selectedItems);
    const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);

    // Toasts + refetch are orchestrated in handleMangaRemove so the success
    // notification fires only AFTER the list has actually refetched.
    // Read through a ref: useMutation returns a new object every render, and
    // depending on it gave the remove handler (and so every cell) a new
    // identity on every scroll step.
    const removeMangaMutation = trpc.manga.remove.useMutation();
    const removeMangaRef = useRef(removeMangaMutation.mutateAsync);
    removeMangaRef.current = removeMangaMutation.mutateAsync;

    // The library page passes the list already filtered and sorted with the
    // same view settings (and shows its own empty-filter state); running
    // filterAndSortManga again here repeated that work on every change.
    const displayedManga = manga;

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
                    await removeMangaRef.current({ id, shouldRemoveFiles });
                    // Wait for the library list to refetch so the card is gone BEFORE
                    // success is reported — the fix for "notify, then UI updates".
                    await onRefreshRef.current();
                },
            ).catch((error: unknown) => {
                logger.error('Failed to remove manga:', error instanceof Error ? error.message : String(error));
            });
        })();
    }, []);

    const ctx: CellContext = useMemo(() => ({
        selectionMode, toggleItemSelection,
        onMangaClick: handleMangaClick,
        onMangaRemove: handleMangaRemove,
        onMangaPrefetch: handleMangaPrefetch,
        onRefresh: stableOnRefresh, libraryId,
    }), [
        selectionMode, toggleItemSelection,
        handleMangaClick, handleMangaRemove, handleMangaPrefetch, stableOnRefresh, libraryId,
    ]);
    const layout: RowLayout = { displayedManga, columnsPerRow, totalCells, selectedItems };

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
                    {buildRowCells(row.index, layout, ctx)}
                </div>
            ))}
        </Box>
    );
}
