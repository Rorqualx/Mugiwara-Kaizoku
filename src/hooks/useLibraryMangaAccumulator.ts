/**
 * Library manga pagination + accumulator hook.
 *
 * Encapsulates the per-library paginated manga list state — tRPC paged fetch,
 * dedup accumulator, infinite-scroll sentinel, auto-drain of remaining pages,
 * and session-scoped snapshot so back-nav returns to the same state instantly.
 *
 * @module hooks/useLibraryMangaAccumulator
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { CHANNEL_PATTERNS } from '@/types/api/v1/websocket';
import {
    getLibraryPageSnapshot,
    setLibraryPageSnapshot,
    type LibraryPageSnapshot,
} from '@/utils/libraryPageCache';
import { trpc } from '@/utils/trpc-client/index';

const PAGE_SIZE = 100;
const AUTO_DRAIN_DELAY_MS = 50;
// iter-LIVEBAR: how long to coalesce burst chapter-update events before
// invalidating the manga.query cache. A pack import can flip dozens of
// chapters in a single second — without coalescing each fires its own
// refetch. 750ms swallows the burst while still feeling immediate.
const REALTIME_INVALIDATE_DEBOUNCE_MS = 750;

export interface UseLibraryMangaAccumulatorResult {
    allManga: unknown[];
    hasMore: boolean;
    isFetching: boolean;
    mangaPage: unknown[] | undefined;
    pendingTitleRows: { id: number; title: string; libraryId: number }[] | undefined;
    refetchAll: () => Promise<unknown>;
    refetchManga: () => Promise<unknown>;
    registerScrollParent: (el: HTMLElement | null) => void;
    registerSentinel: (el: HTMLElement | null) => void;
}

export function useLibraryMangaAccumulator(
    libraryId: number | undefined,
    enabled: boolean,
): UseLibraryMangaAccumulatorResult {
    const snapshot: LibraryPageSnapshot | undefined = libraryId !== undefined ? getLibraryPageSnapshot(libraryId) : undefined;

    const [allManga, setAllManga] = useState<unknown[]>(() => snapshot?.allManga ?? []);
    const [offset, setOffset] = useState<number>(() => snapshot?.offset ?? 0);
    const [hasMore, setHasMore] = useState<boolean>(() => snapshot?.hasMore ?? true);

    const utils = trpc.useUtils();
    const { isConnected, subscribe } = useRealTime();

    const { data: mangaPage, refetch: refetchManga, isFetching } = trpc.manga.query.useQuery(
        { include: { metadata: true, chapters: true, library: true, volumes: true }, limit: PAGE_SIZE, offset },
        { enabled, staleTime: 30 * 1000 }
    );

    // iter-LIVEBAR: subscribe to the library-wide chapter-update broadcast
    // and invalidate the manga.query cache so progress bars (computed
    // client-side from each manga's Chapter[]) update without waiting for
    // the 30s staleTime. Coalesces bursts via a single debounced timer.
    useEffect(() => {
        if (!enabled || !isConnected) return;
        let pending: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = subscribe(CHANNEL_PATTERNS.LIBRARY_CHAPTER_UPDATES, () => {
            if (pending !== null) return;
            pending = setTimeout(() => {
                pending = null;
                void utils.manga.query.invalidate();
            }, REALTIME_INVALIDATE_DEBOUNCE_MS);
        });
        return () => {
            if (pending !== null) clearTimeout(pending);
            unsubscribe();
        };
    }, [enabled, isConnected, subscribe, utils]);
    const { data: pendingTitleRows } = trpc.manga.listTitlesByLibrary.useQuery(
        { libraryId: libraryId ?? 0 },
        { enabled: Boolean(libraryId !== undefined && libraryId > 0), staleTime: 5 * 60 * 1000 }
    );

    useEffect(() => {
        if (!mangaPage) return;
        setAllManga(prev => {
            if (offset === 0) return mangaPage;
            const seen = new Set(prev.map(m => (m as { id: number }).id));
            const fresh = mangaPage.filter(m => !seen.has((m as { id: number }).id));
            return fresh.length ? [...prev, ...fresh] : prev;
        });
        setHasMore(mangaPage.length >= PAGE_SIZE);
    }, [mangaPage, offset]);

    const loadMore = useCallback(() => {
        if (hasMore && !isFetching) setOffset(prev => prev + PAGE_SIZE);
    }, [hasMore, isFetching]);

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

    // Auto-drain: once the first page lands, chain remaining page loads so the
    // alphabet jump bar can target any letter.
    useEffect(() => {
        if (!hasMore || isFetching) return;
        if (allManga.length === 0) return;
        const t = setTimeout(() => { loadMore(); }, AUTO_DRAIN_DELAY_MS);
        return () => clearTimeout(t);
    }, [hasMore, isFetching, allManga.length, loadMore]);

    // Restore scroll on first mount, keyed to the snapshot we initialized from.
    const restoredScrollRef = useRef<boolean>(snapshot === undefined);
    useEffect(() => {
        if (restoredScrollRef.current || !snapshot) return;
        const parent = scrollParentRef.current;
        if (!parent) return;
        parent.scrollTop = snapshot.scrollTop;
        restoredScrollRef.current = true;
    }, [snapshot, allManga]);

    // Save snapshot on unmount so back-nav restores instantly.
    const stateRef = useRef({ allManga, offset, hasMore });
    stateRef.current = { allManga, offset, hasMore };
    useEffect(() => {
        return () => {
            if (libraryId === undefined) return;
            const scrollTop = scrollParentRef.current?.scrollTop ?? 0;
            setLibraryPageSnapshot(libraryId, { ...stateRef.current, scrollTop });
        };
    }, [libraryId]);

    const refetchAll = useCallback(async () => {
        setOffset(0);
        setHasMore(true);
        // Also refresh the title list — otherwise a just-removed manga lingers as a
        // grey skeleton placeholder: its title is still in the 5-min-cached
        // listTitlesByLibrary even though it's gone from the paginated query.
        await Promise.all([
            refetchManga(),
            utils.manga.listTitlesByLibrary.invalidate(),
        ]);
    }, [refetchManga, utils]);

    return {
        allManga,
        hasMore,
        isFetching,
        mangaPage,
        pendingTitleRows,
        refetchAll,
        refetchManga,
        registerScrollParent,
        registerSentinel,
    };
}
