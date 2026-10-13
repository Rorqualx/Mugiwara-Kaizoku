/**
 * Library grid data for the library page.
 *
 * Turns the library view store's settings into the server-side grid view,
 * pages the result with useLibraryMangaAccumulator, and supplies what the page
 * shows around it: the match count, the filter panel's genres and tags, the
 * skeleton cards for the next page, and alphabet-bar jumps to titles that are
 * not loaded yet.
 *
 * Search, filters and sort run on the server, except a regex search: while one
 * is active every page is loaded and the client filters them (as before).
 * A table column sort likewise needs every row (`needAllRows`).
 *
 * @module hooks/library/useLibraryGrid
 */
import { useEffect, useMemo } from 'react';

import { useShallow } from 'zustand/react/shallow';

import { filterAndSortManga } from '@/components/library/utils/libraryUtils';
import { LIBRARY_PAGE_SIZE, useLibraryMangaAccumulator, type UseLibraryMangaAccumulatorResult } from '@/hooks/useLibraryMangaAccumulator';
import { useLibraryViewStore } from '@/store/index';
import type { MangaWithRelations } from '@/types/search.types';
import {
    buildServerView, findLetterIndex, isUnfilteredAlphabetical, needsClientSearch, type GridMediaType,
} from '@/utils/library/grid-view';
import { trpc } from '@/utils/trpc-client/index';

/** Generic skeleton cards on the very first load, before the count is known. */
const INITIAL_SKELETONS = 12;

export interface LibraryGridSkeletons {
    count: number;
    titles: string[];
}

export interface UseLibraryGridResult extends Omit<UseLibraryMangaAccumulatorResult, 'allManga' | 'pendingTitleRows' | 'loadThrough'> {
    /** Rows to show, in order. */
    displayedManga: MangaWithRelations[];
    /** How many titles the current settings match ('+' while not yet known exactly). */
    matchLabel: string;
    /** Titles in the library. */
    libraryCount: number | undefined;
    /** Ids of every title in the library (selection mode's Select All). */
    libraryIds: string[];
    availableGenres: string[];
    availableTags: string[];
    skeletons: LibraryGridSkeletons;
    /** True when the client applies part of the view and so loads every page. */
    clientFiltering: boolean;
}

const TITLE_ORDER = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

 
export function useLibraryGrid(
    libraryId: number | undefined,
    enabled: boolean,
    mediaType: GridMediaType,
    needAllRows: boolean,
): UseLibraryGridResult {
    const settings = useLibraryViewStore(useShallow(state => ({
        sortBy: state.sortBy,
        filterBy: state.filterBy,
        searchQuery: state.searchQuery,
        searchField: state.searchField,
        enableRegexSearch: state.enableRegexSearch,
        advancedFilters: state.advancedFilters,
    })));
    const clientSearch = needsClientSearch(settings);
    const view = useMemo(() => buildServerView({ ...settings, mediaType }), [settings, mediaType]);

    const acc = useLibraryMangaAccumulator(libraryId, enabled, view, clientSearch || needAllRows);
    const { allManga, hasMore, isFetching, pendingTitleRows, loadThrough } = acc;

    const summaryEnabled = enabled && libraryId !== undefined && !clientSearch;
    const { data: summary } = trpc.manga.libraryGridSummary.useQuery(
        { libraryId: libraryId ?? 0, view },
        { enabled: summaryEnabled, staleTime: 30 * 1000 },
    );
    const { data: facets } = trpc.manga.libraryGridFacets.useQuery(
        { libraryId: libraryId ?? 0 },
        { enabled: enabled && libraryId !== undefined, staleTime: 5 * 60 * 1000 },
    );

    const displayedManga = useMemo(() => {
        const rows = allManga as MangaWithRelations[];
        // The server already filtered and sorted the rows; only a regex search
        // is left to the client (over every page, see drainAll).
        return clientSearch ? filterAndSortManga(rows, { ...settings }) as MangaWithRelations[] : rows;
    }, [allManga, clientSearch, settings]);

    const loadedIds = useMemo(() => new Set(allManga.map(m => (m as { id: number }).id)), [allManga]);

    // Skeleton cards for the next page. Real titles only when the next rows are
    // predictable (library order, nothing filtered); generic cards otherwise.
    const predictable = isUnfilteredAlphabetical(view) && !clientSearch;
    const sortedTitles = useMemo(
        () => (predictable ? (pendingTitleRows ?? []).map(r => ({ id: r.id, title: r.title })).sort((a, b) => TITLE_ORDER(a.title, b.title)) : []),
        [predictable, pendingTitleRows],
    );
    const skeletons = useMemo((): LibraryGridSkeletons => {
        if (!hasMore) return { count: 0, titles: [] };
        const known = clientSearch ? pendingTitleRows?.length : summary?.total;
        if (known === undefined) {
            return { count: isFetching && allManga.length === 0 ? INITIAL_SKELETONS : 0, titles: [] };
        }
        const count = Math.max(0, Math.min(LIBRARY_PAGE_SIZE, known - allManga.length));
        const titles = predictable ? sortedTitles.filter(r => !loadedIds.has(r.id)).slice(0, count).map(r => r.title) : [];
        return { count, titles };
    }, [hasMore, clientSearch, pendingTitleRows, summary, isFetching, allManga.length, predictable, sortedTitles, loadedIds]);

    // Alphabet-bar jump to a letter whose titles are not loaded yet: ask the
    // server where the letter starts and load the pages up to it. PosterView
    // keeps the jump pending and scrolls once the rows arrive.
    const utils = trpc.useUtils();
    useEffect(() => {
        if (typeof window === 'undefined' || libraryId === undefined) return;
        const handler = (event: Event): void => {
            const letter = ((event as CustomEvent).detail as { letter?: string } | undefined)?.letter;
            if (!letter || !hasMore || clientSearch || needAllRows) return;
            if (findLetterIndex(displayedManga, letter) !== -1) return;
            void utils.manga.libraryGridSummary.fetch({ libraryId, view, letter })
                .then(({ letterIndex }) => (letterIndex !== null && letterIndex >= 0 ? loadThrough(letterIndex) : undefined));
        };
        window.addEventListener('library-jump', handler);
        return () => window.removeEventListener('library-jump', handler);
    }, [libraryId, view, hasMore, clientSearch, needAllRows, displayedManga, loadThrough, utils]);

    const libraryIds = useMemo(
        () => (pendingTitleRows ?? (allManga as Array<{ id: number }>)).map(r => String(r.id)),
        [pendingTitleRows, allManga],
    );

    return {
        hasMore: acc.hasMore,
        isFetching: acc.isFetching,
        refetchAll: acc.refetchAll,
        registerScrollParent: acc.registerScrollParent,
        registerSentinel: acc.registerSentinel,
        displayedManga,
        matchLabel: !clientSearch && summary !== undefined
            ? String(summary.total)
            : `${displayedManga.length}${hasMore ? '+' : ''}`,
        libraryCount: pendingTitleRows?.length,
        libraryIds,
        availableGenres: facets?.genres ?? [],
        availableTags: facets?.tags ?? [],
        skeletons,
        clientFiltering: clientSearch,
    };
}
