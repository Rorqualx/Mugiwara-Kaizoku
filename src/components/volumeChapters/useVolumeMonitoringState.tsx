/**
 * Volume Monitoring State Hook
 *
 * Custom hook that calculates monitoring status for a volume based on its chapters.
 * Provides derived state indicating if all, some, or no chapters are monitored.
 *
 * @module useVolumeMonitoringState
 */

import { useMemo } from 'react';

import type { Chapter } from '@prisma/client';

/**
 * Parameters for the useVolumeMonitoringState hook
 */
export interface UseVolumeMonitoringStateParams {
    /** Array of chapters in the volume */
    chapters: Chapter[];
}

/**
 * Return value from the useVolumeMonitoringState hook
 */
export interface UseVolumeMonitoringStateReturn {
    /** Total number of chapters in the volume */
    totalVolumeChapters: number;
    /** Number of monitored chapters */
    volumeMonitoredCount: number;
    /** Whether all chapters are monitored */
    allVolumeMonitored: boolean;
    /** Whether some (but not all) chapters are monitored */
    someVolumeMonitored: boolean;
    /** Whether no chapters are monitored */
    noneVolumeMonitored: boolean;
}

/**
 * Hook for calculating volume monitoring state
 *
 * Derives monitoring status directly from the chapters array.
 * Provides boolean flags for all, some, or none monitoring states.
 *
 * @param params - Hook parameters
 * @returns Monitoring state flags
 *
 * @example
 * ```tsx
 * const {
 *   allVolumeMonitored,
 *   someVolumeMonitored,
 *   noneVolumeMonitored,
 *   volumeMonitoredCount,
 *   totalVolumeChapters
 * } = useVolumeMonitoringState({ chapters });
 * ```
 */
export function useVolumeMonitoringState({
    chapters
}: UseVolumeMonitoringStateParams): UseVolumeMonitoringStateReturn {
    return useMemo(() => {
        const totalVolumeChapters = chapters.length;
        const volumeMonitoredCount = chapters.filter((ch: Chapter) => ch.monitored).length;
        const allVolumeMonitored = totalVolumeChapters > 0 && volumeMonitoredCount === totalVolumeChapters;
        const someVolumeMonitored = volumeMonitoredCount > 0 && volumeMonitoredCount < totalVolumeChapters;
        const noneVolumeMonitored = volumeMonitoredCount === 0;

        return {
            totalVolumeChapters,
            volumeMonitoredCount,
            allVolumeMonitored,
            someVolumeMonitored,
            noneVolumeMonitored
        };
    }, [chapters]);
}
