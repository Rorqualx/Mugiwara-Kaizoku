/**
 * Library manga pagination + accumulator hook.
 *
 * The server filters, searches and sorts the library (manga.query with a
 * `view`) and this hook loads the result a page at a time: the first page on
 * open, the next one when the infinite-scroll sentinel nears the viewport, and
 * every page up to a row on request (alphabet-bar jumps). Changing the view
 * starts over from the first page. `drainAll` restores the old behaviour of
 * loading every page, for the settings the client still applies itself.
 *
 * Also keeps a session snapshot so back-nav returns to the same rows
 * instantly, and refreshes only the affected pages on realtime chapter updates.
 *
 * @module hooks/useLibraryMangaAccumulator
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { CHANNEL_PATTERNS } from '@/types/api/v1/websocket';
import { gridViewKey, viewDependsOnChapters, type LibraryGridView } from '@/utils/library/grid-view';
import {
    flattenPages, mergePages, missingPageOffsets, pagesContaining, pagesFromRows, type MangaPages,
} from '@/utils/library/manga-page-merge';
import { getLibraryPageSnapshot, setLibraryPageSnapshot } from '@/utils/libraryPageCache';
import { trpc } from '@/utils/trpc-client/index';

export const LIBRARY_PAGE_SIZE = 100;
const AUTO_DRAIN_DELAY_MS = 50;
/** Pages fetched at once when loading several (jump, refresh). */
const FETCH_CONCURRENCY = 4;
// iter-LIVEBAR: how long to coalesce burst chapter-update events before
// refreshing. A pack import can flip dozens of chapters in a single second —
// without coalescing each fires its own refetch. 750ms swallows the burst
// while still feeling immediate.
const REALTIME_INVALIDATE_DEBOUNCE_MS = 750;

export interface UseLibraryMangaAccumulatorResult {
    allManga: unknown[];
    hasMore: boolean;
    isFetching: boolean;
    pendingTitleRows: { id: number; title: string; libraryId: number }[] | undefined;
    /** Loads every page up to the one holding row `index` of the current view. */
    loadThrough: (index: number) => Promise<void>;
    refetchAll: () => Promise<unknown>;
    registerScrollParent: (el: HTMLElement | null) => void;
    registerSentinel: (el: HTMLElement | null) => void;
}

interface GridState {
    key: string;
    pages: MangaPages;
    /** Offset of the page the query observes (the last one loaded). */
    offset: number;
    hasMore: boolean;
}

function freshState(key: string): GridState {
    return { key, pages: new Map(), offset: 0, hasMore: true };
}

function initialState(key: string, libraryId: number | undefined): GridState {
    const snapshot = libraryId !== undefined ? getLibraryPageSnapshot(libraryId) : undefined;
    if (snapshot?.key !== key) return freshState(key);
    return { key, pages: pagesFromRows(snapshot.allManga, LIBRARY_PAGE_SIZE), offset: snapshot.offset, hasMore: snapshot.hasMore };
}

/** Runs the tasks a few at a time, keeping their order. */
async function inBatches<T>(tasks: Array<() => Promise<T>>, size: number): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < tasks.length; i += size) {
        // eslint-disable-next-line no-await-in-loop -- deliberate: at most `size` page requests in flight
        out.push(...await Promise.all(tasks.slice(i, i + size).map((t) => t())));
    }
    return out;
}

 
export function useLibraryMangaAccumulator(
    libraryId: number | undefined,
    enabled: boolean,
    view: LibraryGridView,
    drainAll: boolean,
): UseLibraryMangaAccumulatorResult {
    const key = `${libraryId ?? ''}|${gridViewKey(view)}`;
    const [stored, setGrid] = useState<GridState>(() => initialState(key, libraryId));
    // A new view (or library) starts over from the first page.
    if (stored.key !== key) setGrid(freshState(key));
    const grid = stored.key === key ? stored : freshState(key);
    const { pages, offset, hasMore } = grid;
    const allManga = useMemo(() => flattenPages(pages), [pages]);

    const utils = trpc.useUtils();
    const { isConnected, subscribe } = useRealTime();

    const viewRef = useRef(view);
    viewRef.current = view;
    const pageInput = useCallback((pageOffset: number) => ({
        include: { metadata: true, chapters: true, library: true, volumes: true },
        limit: LIBRARY_PAGE_SIZE,
        offset: pageOffset,
        ...(libraryId !== undefined ? { libraryId, view: viewRef.current } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the view; viewRef supplies it
    }), [libraryId, key]);

    const { data: mangaPage, isFetching } = trpc.manga.query.useQuery(
        pageInput(offset),
        { enabled, staleTime: 30 * 1000 }
    );

    useEffect(() => {
        if (!mangaPage) return;
        setGrid(prev => (prev.key !== key || prev.offset !== offset)
            ? prev
            : { ...prev, ...mergePages(prev.pages, [{ offset, rows: mangaPage }], LIBRARY_PAGE_SIZE) });
    }, [mangaPage, offset, key]);

    const pagesRef = useRef(pages);
    pagesRef.current = pages;

    /** Fetches the given pages fresh and swaps them in (for the view they were requested for). */
    const fetchPages = useCallback(async (offsets: number[], fresh: boolean): Promise<void> => {
        if (offsets.length === 0) return;
        const requestedKey = key;
        const fetched = await inBatches(offsets.map((o) => async () => ({
            offset: o,
            rows: await utils.manga.query.fetch(pageInput(o), fresh ? { staleTime: 0 } : {}),
        })), FETCH_CONCURRENCY);
        setGrid(prev => {
            if (prev.key !== requestedKey) return prev;
            const merged = mergePages(prev.pages, fetched, LIBRARY_PAGE_SIZE);
            return { ...prev, ...merged, offset: Math.max(0, ...merged.pages.keys()) };
        });
    }, [key, utils, pageInput]);

    // Re-fetches every loaded page in place (rows stay on screen meanwhile),
    // so the grid keeps its depth and scroll position. With nothing loaded yet
    // the observed first page is simply refetched.
    const reloadLoaded = useCallback(async (): Promise<void> => {
        const offsets = [...pagesRef.current.keys()].sort((a, b) => a - b);
        if (offsets.length === 0) {
            await utils.manga.query.invalidate();
            return;
        }
        await fetchPages(offsets, true);
    }, [fetchPages, utils]);

    // Re-fetches only the loaded pages holding these titles. Falls back to
    // reloading every loaded page when a title is on no loaded page, a page
    // comes back short (titles shifted), or the view's filter/order depends on
    // chapter state (an update can move titles between pages).
    const refreshTitles = useCallback(async (mangaIds: ReadonlySet<number>): Promise<void> => {
        const { offsets, missing } = pagesContaining(pagesRef.current, mangaIds);
        if (missing.length > 0 || offsets.length === 0 || viewDependsOnChapters(viewRef.current)) {
            await reloadLoaded();
            return;
        }
        await fetchPages(offsets, true);
    }, [reloadLoaded, fetchPages]);

    // iter-LIVEBAR: subscribe to the library-wide chapter-update broadcast
    // and refresh the affected titles so progress bars update without waiting
    // for the 30s staleTime. Coalesces bursts via a single debounced timer.
    useEffect(() => {
        if (!enabled || !isConnected) return;
        let pending: ReturnType<typeof setTimeout> | null = null;
        let touched = new Set<number>();
        let unknownTitle = false;
        const unsubscribe = subscribe(CHANNEL_PATTERNS.LIBRARY_CHAPTER_UPDATES, (event) => {
            const mangaId = (event.data as { mangaId?: unknown } | undefined)?.mangaId;
            if (typeof mangaId === 'number') touched.add(mangaId);
            else unknownTitle = true;
            if (pending !== null) return;
            pending = setTimeout(() => {
                pending = null;
                const ids = touched;
                const fullRefresh = unknownTitle;
                touched = new Set();
                unknownTitle = false;
                void (fullRefresh ? reloadLoaded() : refreshTitles(ids));
            }, REALTIME_INVALIDATE_DEBOUNCE_MS);
        });
        return () => {
            if (pending !== null) clearTimeout(pending);
            unsubscribe();
        };
    }, [enabled, isConnected, subscribe, reloadLoaded, refreshTitles]);

    const { data: pendingTitleRows } = trpc.manga.listTitlesByLibrary.useQuery(
        { libraryId: libraryId ?? 0 },
        { enabled: Boolean(libraryId !== undefined && libraryId > 0), staleTime: 5 * 60 * 1000 }
    );

    const loadMore = useCallback(() => {
        if (hasMore && !isFetching) {
            // Advance only past a page that has landed: the sentinel and the
            // auto-drain can both fire before isFetching flips, and a second
            // advance would skip a page.
            setGrid(prev => (prev.key === key && prev.hasMore && prev.pages.has(prev.offset)
                ? { ...prev, offset: prev.offset + LIBRARY_PAGE_SIZE }
                : prev));
        }
    }, [hasMore, isFetching, key]);

    const loadThrough = useCallback(async (index: number): Promise<void> => {
        await fetchPages(missingPageOffsets(pagesRef.current, index, LIBRARY_PAGE_SIZE), false);
    }, [fetchPages]);

    const scrollParentRef = useRef<HTMLElement | null>(null);
    const sentinelRef = useRef<HTMLElement | null>(null);
    const [observerKey, setObserverKey] = useState(0);

    const registerScrollParent = useCallback((el: HTMLElement | null) => {
        if (scrollParentRef.current === el) return;
        scrollParentRef.current = el;
        setObserverKey(k => k + 1);
    }, []);
    const registerSentinel = useCallback((el: HTMLElement | null) => {
        if (sentinelRef.current === el) return;
        sentinelRef.current = el;
        setObserverKey(k => k + 1);
    }, []);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const root = scrollParentRef.current;
        if (!sentinel || !root || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
            { root, rootMargin: '600px 0px', threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadMore, observerKey]);

    // Auto-drain, only while a setting the client applies itself is active
    // (e.g. regex search): it needs every row to filter.
    useEffect(() => {
        if (!drainAll || !hasMore || isFetching) return;
        if (allManga.length === 0) return;
        const t = setTimeout(() => { loadMore(); }, AUTO_DRAIN_DELAY_MS);
        return () => clearTimeout(t);
    }, [drainAll, hasMore, isFetching, allManga.length, loadMore]);

    // Restore scroll on first mount when the snapshot matched this view.
    const restoredScrollRef = useRef<boolean>(false);
    useEffect(() => {
        if (restoredScrollRef.current || libraryId === undefined) return;
        const snapshot = getLibraryPageSnapshot(libraryId);
        const parent = scrollParentRef.current;
        if (!parent || allManga.length === 0) return;
        restoredScrollRef.current = true;
        if (snapshot?.key === key) parent.scrollTop = snapshot.scrollTop;
    // observerKey: re-run once the scroll parent registers (it mounts after the header loads).
    }, [libraryId, key, allManga, observerKey]);

    // Track the scroll position as it changes: by the time the unmount cleanup
    // runs the viewport is detached and reads scrollTop 0.
    const scrollTopRef = useRef(0);
    useEffect(() => {
        const parent = scrollParentRef.current;
        if (!parent) return;
        const onScroll = (): void => { scrollTopRef.current = parent.scrollTop; };
        parent.addEventListener('scroll', onScroll, { passive: true });
        return () => parent.removeEventListener('scroll', onScroll);
    }, [observerKey]);

    // Save snapshot on unmount so back-nav restores instantly.
    const stateRef = useRef({ key, allManga, offset, hasMore });
    stateRef.current = { key, allManga, offset, hasMore };
    useEffect(() => {
        return () => {
            if (libraryId === undefined) return;
            setLibraryPageSnapshot(libraryId, { ...stateRef.current, scrollTop: scrollTopRef.current });
        };
    }, [libraryId]);

    const refetchAll = useCallback(async () => {
        // Also refresh the title list (a just-removed manga would otherwise
        // linger as a grey skeleton placeholder from the 5-min-cached
        // listTitlesByLibrary) and the counts/facets.
        await Promise.all([
            reloadLoaded(),
            utils.manga.listTitlesByLibrary.invalidate(),
            utils.manga.libraryGridSummary.invalidate(),
            utils.manga.libraryGridFacets.invalidate(),
        ]);
    }, [reloadLoaded, utils]);

    return {
        allManga,
        hasMore,
        isFetching,
        pendingTitleRows,
        loadThrough,
        refetchAll,
        registerScrollParent,
        registerSentinel,
    };
}
