/**
 * Pull to Refresh Component
 *
 * Provides pull-to-refresh functionality for scrollable content:
 * - Visual feedback during pull
 * - Customizable threshold
 * - Loading states
 * - Smooth animations
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';

import { Box, Loader, Text} from '@mantine/core';
import { IconRefresh, IconCheck } from '@tabler/icons-react';

import { useMobileState } from '@/hooks/mobile';
import { logger } from '@/utils/logger';
interface PullToRefreshProps {
    /** Content to make refreshable */
    children: React.ReactNode;
    /** Refresh handler */
    onRefresh: () => Promise<void>;
    /** Pull threshold in pixels */
    threshold?: number;
    /** Maximum pull distance */
    maxPull?: number;
    /** Whether pull to refresh is enabled */
    enabled?: boolean;
    /** Custom refresh indicator */
    refreshIndicator?: React.ReactNode;
    /** Success message */
    successMessage?: string;
    /** Success display duration */
    successDuration?: number;
}
type RefreshState = 'idle' | 'pulling' | 'releasing' | 'refreshing' | 'success';
export function PullToRefresh({ children, onRefresh, threshold = 80, maxPull = 150, enabled = true, refreshIndicator, successMessage = 'Updated', successDuration = 1500 }: PullToRefreshProps): React.ReactElement {
    const { touchSettings } = useMobileState();
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const startYRef = useRef<number | null>(null);
    const isEnabledRef = useRef(enabled && touchSettings.pullToRefreshEnabled);
    // Update enabled state
    useEffect(() => {
        isEnabledRef.current = enabled && touchSettings.pullToRefreshEnabled;
    }, [enabled, touchSettings.pullToRefreshEnabled]);
    // Handle touch start
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!isEnabledRef.current || refreshState !== 'idle')
            return;
        const touch = e.touches[0];
        if (!touch || !containerRef.current)
            return;
        // Only start pull if at top of scroll
        if (containerRef.current.scrollTop === 0) {
            startYRef.current = touch.clientY;
        }
    }, [refreshState]);
    // Handle touch move
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!startYRef.current || refreshState !== 'idle' && refreshState !== 'pulling')
            return;
        const touch = e.touches[0];
        if (!touch)
            return;
        const deltaY = touch.clientY - startYRef.current;
        if (deltaY > 0 && containerRef.current?.scrollTop === 0) {
            e.preventDefault();
            // Apply resistance to pull
            const resistance = 0.5;
            const adjustedDelta = deltaY * resistance;
            const clampedDistance = Math.min(adjustedDelta, maxPull);
            setPullDistance(clampedDistance);
            if (clampedDistance >= threshold && refreshState === 'idle') {
                setRefreshState('pulling');
                // Haptic feedback would go here
            }
            else if (clampedDistance < threshold && refreshState === 'pulling') {
                setRefreshState('idle');
            }
        }
    }, [maxPull, threshold, refreshState]);
    // Handle touch end
    const handleTouchEnd = useCallback(async () => {
        if (!startYRef.current)
            return;
        startYRef.current = null;
        if (pullDistance >= threshold && refreshState === 'pulling') {
            setRefreshState('releasing');
            setPullDistance(60); // Hold at indicator height
            try {
                setRefreshState('refreshing');
                await onRefresh();
                setRefreshState('success');
                setTimeout(() => {
                    setRefreshState('idle');
                    setPullDistance(0);
                }, successDuration);
            }
            catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Refresh failed:', errorMessage);
                setRefreshState('idle');
                setPullDistance(0);
            }
        }
        else {
            setRefreshState('idle');
            setPullDistance(0);
        }
    }, [pullDistance, threshold, refreshState, onRefresh, successDuration]);
    // Calculate opacity based on pull distance
    const indicatorOpacity = Math.min(1, pullDistance / threshold);
    const indicatorScale = 0.8 + 0.2 * Math.min(1, pullDistance / threshold);
    // Default refresh indicator
    const defaultIndicator = <Box style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 60,
            opacity: indicatorOpacity,
            transform: `scale(${indicatorScale})`,
            transition: refreshState === 'idle' || refreshState === 'pulling' ?
                'none' :
                'all 0.3s ease'
        }}>

      {refreshState === 'refreshing' ?
            <Loader size="sm" color="blue"/> :
            refreshState === 'success' ?
                <Box style={{ textAlign: 'center' }}>
          <IconCheck size={24} color="var(--mantine-color-green-6)"/>
          <Text size="xs" c="green" mt={4}>{successMessage}</Text>
        </Box> :
                <Box style={{ textAlign: 'center' }}>
          <Box style={{
                        transform: `rotate(${pullDistance * 2}deg)`,
                        transition: 'none'
                    }}>

            <IconRefresh size={24} color={refreshState === 'pulling' ?
                        'var(--mantine-color-blue-6)' :
                        'var(--mantine-color-gray-6)'}/>

          </Box>
          <Text size="xs" c="dimmed" mt={4}>
            {refreshState === 'pulling' ? 'Release to refresh' : 'Pull to refresh'}
          </Text>
        </Box>}
    </Box>;
    return (<Box ref={containerRef} style={{
            position: 'relative',
            height: '100%',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch'
        }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => { void handleTouchEnd(); }} onTouchCancel={() => {
            startYRef.current = null;
            if (refreshState === 'idle' || refreshState === 'pulling') {
                setRefreshState('idle');
                setPullDistance(0);
            }
        }}>

      {/* Refresh indicator */}
      <Box style={{
            position: 'absolute',
            top: -60,
            left: 0,
            right: 0,
            height: 60,
            transform: `translateY(${Math.min(pullDistance, 60)}px)`,
            transition: refreshState === 'idle' || refreshState === 'pulling' ?
                'none' :
                'transform 0.3s ease',
            zIndex: 10,
            pointerEvents: 'none'
        }}>

        {refreshIndicator ?? defaultIndicator}
      </Box>

      {/* Content */}
      <Box ref={contentRef} style={{
            transform: `translateY(${pullDistance}px)`,
            transition: refreshState === 'idle' || refreshState === 'pulling' ?
                'none' :
                'transform 0.3s ease'
        }}>

        {children}
      </Box>
    </Box>);
}
