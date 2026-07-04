/**
 * Responsive Navigation Component
 * 
 * Intelligently switches between desktop sidebar navigation
 * and mobile navigation patterns based on device type
 */

import React, { useState, useCallback, useEffect } from 'react';

import { useMobileState } from '@/hooks/mobile';
import { useBreakpoint } from '@/hooks/mobile';
import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client/index';

import { MobileBottomNavigation } from './MobileBottomNavigation';
import { MobileNavigationDrawer } from './MobileNavigationDrawer';

interface ActivityCounts {
  active: number;
  queued: number;
  scheduled: number;
  failed: number;
  completed: number;
  outOfSync: number;
}

interface ResponsiveNavigationProps {
  /** Activity counts for badges */
  activityCounts?: ActivityCounts;
}

export function ResponsiveNavigation({
  activityCounts
}: ResponsiveNavigationProps): React.ReactElement | null {
  const { isMobile, isTablet } = useBreakpoint();
  useMobileState();
  const [drawerOpened, setDrawerOpened] = useState(false);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Get activity data if not provided with WebSocket + polling fallback
  const activityQuery = trpc.activity.query.useQuery(undefined, {
    enabled: !activityCounts,
    refetchInterval: isConnected ? false : 30000 // Only poll when WebSocket disconnected
  });

  // Subscribe to WebSocket job events for real-time updates (reuses existing jobs:active channel)
  // Extract refetch to avoid infinite loop (activityQuery object changes every render)
  const { refetch: refetchActivity } = activityQuery;
  useEffect(() => {
    if (!isConnected || activityCounts) return;

    const unsubscribe = subscribe('jobs:active', () => {
      void refetchActivity();
    });

    return unsubscribe;
  }, [isConnected, subscribe, activityCounts, refetchActivity]);

  const defaultActivityCounts: ActivityCounts = {
    active: 0,
    queued: 0,
    scheduled: 0,
    failed: 0,
    completed: 0,
    outOfSync: 0
  };

  // Use query data if available and matches ActivityCounts shape
  const queryData = activityQuery.data;
  const hasValidQueryData = queryData !== undefined &&
    typeof queryData === 'object' &&
    'active' in queryData &&
    'queued' in queryData &&
    'scheduled' in queryData &&
    'failed' in queryData &&
    'completed' in queryData &&
    'outOfSync' in queryData;

  const finalActivityCounts: ActivityCounts = activityCounts ??
    (hasValidQueryData ? queryData as ActivityCounts : defaultActivityCounts);

  // Handle drawer open/close
  const handleOpenDrawer = useCallback((): void => {
    setDrawerOpened(true);
  }, []);

  const handleCloseDrawer = useCallback((): void => {
    setDrawerOpened(false);
  }, []);

  // Tablets get the same phone-style navigation as mobile (drawer + bottom nav).
  const showMobileNav = isMobile || isTablet;

  // Don't render mobile navigation on desktop
  if (!showMobileNav) {
    return null;
  }

  // Both mobile and tablet render the same nav; the early return above already
  // excludes desktop, so no per-element guard is needed here.
  return (
    <>
      {/* Navigation Drawer (mobile + tablet) */}
      <MobileNavigationDrawer
        opened={drawerOpened}
        onClose={handleCloseDrawer}
        activityCounts={{
          active: finalActivityCounts.active,
          failed: finalActivityCounts.failed,
        }}
      />

      {/* Bottom Navigation (mobile + tablet) */}
      <MobileBottomNavigation
        onMenuClick={handleOpenDrawer}
        activityCounts={{
          active: finalActivityCounts.active,
          failed: finalActivityCounts.failed
        }}
      />
    </>);

}