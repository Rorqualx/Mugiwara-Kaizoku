/**
 * Volume Expansion State Hook
 *
 * Custom hook that manages the expansion/collapse state of a volume section.
 * Handles both local state and global expansion control with manual override.
 *
 * @module useVolumeExpansionState
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Parameters for the useVolumeExpansionState hook
 */
export interface UseVolumeExpansionStateParams {
    /** Global expansion state from parent component */
    allExpanded: boolean | undefined;
}

/**
 * Return value from the useVolumeExpansionState hook
 */
export interface UseVolumeExpansionStateReturn {
    /** Whether the volume is currently expanded */
    isExpanded: boolean;
    /** Function to toggle the expansion state */
    toggleExpanded: (e?: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Hook for managing volume expansion state
 *
 * Manages both local expansion state and respects global expansion control
 * from parent components. Supports manual override of global state.
 *
 * @param params - Hook parameters
 * @returns Expansion state and toggle function
 *
 * @example
 * ```tsx
 * const { isExpanded, toggleExpanded } = useVolumeExpansionState({
 *   allExpanded: globalExpandedState
 * });
 * ```
 */
export function useVolumeExpansionState({
    allExpanded
}: UseVolumeExpansionStateParams): UseVolumeExpansionStateReturn {
    // Local state management for expansion - default to collapsed
    const [localExpanded, setLocalExpanded] = useState(allExpanded ?? false);
    const [manuallyToggled, setManuallyToggled] = useState(false);

    // Reset manual toggle when global state changes
    useEffect(() => {
        if (allExpanded !== undefined) {
            setManuallyToggled(false);
        }
    }, [allExpanded]);

    // Determine effective expansion state
    const isExpanded = manuallyToggled ? localExpanded : (allExpanded ?? localExpanded);

    /**
     * Toggles the volume's expanded state
     * Handles both manual clicks and global state changes
     *
     * @param e - Optional mouse event that triggered the toggle
     */
    const toggleExpanded = useCallback((e?: React.MouseEvent<HTMLElement>) => {
        if (e) {
            e.stopPropagation();
        }
        setManuallyToggled(true);
        setLocalExpanded((prev: boolean) => !prev);
    }, []);

    return {
        isExpanded,
        toggleExpanded
    };
}
