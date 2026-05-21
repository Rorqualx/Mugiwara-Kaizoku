/**
 * Reading Progress Hooks
 *
 * React hooks for fetching and managing chapter reading progress.
 * Extracted from: hooks.ts (lines 55-124)
 */

import * as React from 'react';
import { useMemo, useEffect } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ReadingProgress {
    currentPage: number;
    totalPages: number;
    completedAt: Date | null;
}

export type ProgressMap = Map<number, ReadingProgress>;

interface ProgressItem {
    chapterId: number;
    currentPage: number;
    totalPages: number;
    completedAt: Date | null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetches reading progress for all chapters in a manga
 *
 * @param mangaId - The manga ID to fetch progress for
 * @returns tRPC query result with progress list
 */
export function useChapterProgress(
    mangaId: number | undefined
): ReturnType<typeof trpc.reader.getMangaProgress.useQuery> {
    // WebSocket connection for real-time updates
    const { isConnected } = useRealTime();

    return trpc.reader.getMangaProgress.useQuery(
        { mangaId: mangaId ?? 0 },
        {
            enabled: !!mangaId,
            refetchOnWindowFocus: !isConnected, // Only refetch on window focus when WebSocket disconnected
            staleTime: 10000
        }
    );
}

/**
 * Creates a map of chapterId -> reading progress for quick lookup
 *
 * @param progressList - Raw progress list from API
 * @returns Map of chapter IDs to progress data
 */
export function useProgressMap(progressList: unknown[] | undefined): ProgressMap {
    return useMemo(() => {
        const map = new Map<number, ReadingProgress>();
        if (progressList && Array.isArray(progressList)) {
            progressList.forEach((progress: unknown) => {
                if (
                    progress &&
                    typeof progress === 'object' &&
                    'chapterId' in progress &&
                    'currentPage' in progress &&
                    'totalPages' in progress &&
                    'completedAt' in progress
                ) {
                    const validProgress = progress as ProgressItem;
                    map.set(validProgress.chapterId, {
                        currentPage: validProgress.currentPage,
                        totalPages: validProgress.totalPages,
                        completedAt: validProgress.completedAt
                    });
                }
            });
        }
        return map;
    }, [progressList]);
}

/**
 * Verifies that chapter files actually exist on disk
 *
 * @param chapterIds - Array of chapter IDs to verify
 * @returns tRPC query result with file verification status
 */
export function useChapterFileVerification(
    chapterIds: number[]
): ReturnType<typeof trpc.reader.verifyChapterFiles.useQuery> {
    // WebSocket connection for real-time updates
    const { isConnected, subscribe } = useRealTime();

    const query = trpc.reader.verifyChapterFiles.useQuery(
        { chapterIds },
        {
            enabled: chapterIds.length > 0,
            refetchOnWindowFocus: false, // Disable window focus refetch to prevent excessive calls
            refetchInterval: false, // Disable polling - rely on WebSocket for updates
            staleTime: 30000, // Keep data fresh for 30 seconds
            gcTime: 60000, // Keep in cache for 60 seconds
        }
    );

    // Use ref to avoid dependency on query object (which changes every render)
    const queryRefetchRef = React.useRef(query.refetch);
    queryRefetchRef.current = query.refetch;

    // Subscribe to WebSocket library events for real-time file updates
    useEffect(() => {
        if (!isConnected || chapterIds.length === 0) return;

        const unsubscribe = subscribe('library:scan:completed', () => {
            void queryRefetchRef.current();
        });

        return unsubscribe;
    }, [isConnected, subscribe, chapterIds.length]);

    return query;
}
