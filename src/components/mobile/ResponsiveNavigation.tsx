/**
 * Responsive Navigation Component
 * 
 * Intelligently switches between desktop sidebar navigation
 * and mobile navigation patterns based on device type
 */

import React, { useState, useCallback } from 'react';

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

  // WebSocket connection state decides whether to poll
  const { isConnected } = useRealTime();

  // Get activity data if not provided. While connected, job events refresh
  // this query through useActivityLiveUpdates (mounted once in AppProviders).
  const activityQuery = trpc.activity.query.useQuery(undefined, {
    enabled: !activityCounts,
    refetchInterval: isConnected ? false : 30000 // Only poll when WebSocket disconnected
  });

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