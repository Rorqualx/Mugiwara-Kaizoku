/**
 * TaskActionBar component for task pages
 *
 * This component provides a task-specific action bar with navigation,
 * refresh, and task management actions.
 *
 * Now uses WebSocket for real-time updates with fallback to polling.
 */

import React, { useEffect, useCallback } from "react";
import type { ComponentType } from 'react';

import { Group, ActionIcon, Box, Button, Badge, Tooltip} from "@mantine/core";
import {
  IconRefresh,
  IconLayoutGrid,
  IconClock,
  IconCheck,
  IconX,
  IconCalendar,
  IconAlertTriangle,
  IconWifi,
  IconWifiOff
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { useNavigation } from '@/hooks/useNavigation';
import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { trpc } from '@/utils/trpc-client/index';

import type { TablerIconsProps } from '@tabler/icons-react';

// Navigation configuration
interface NavItem {
  route: string;
  label: string;
  icon: ComponentType<TablerIconsProps>;
  path: string;
}

const navItems: readonly NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: IconLayoutGrid, path: '/tasks/dashboard' },
  { route: 'active', label: 'Active', icon: IconClock, path: '/tasks/active' },
  { route: 'queued', label: 'Queued', icon: IconClock, path: '/tasks/queued' },
  { route: 'scheduled', label: 'Scheduled', icon: IconCalendar, path: '/tasks/scheduled' },
  { route: 'completed', label: 'Completed', icon: IconCheck, path: '/tasks/completed' },
  { route: 'failed', label: 'Failed', icon: IconX, path: '/tasks/failed' },
  { route: 'out-of-sync', label: 'Out of Sync', icon: IconAlertTriangle, path: '/tasks/out-of-sync' },
] as const;

export function TaskActionBar(): React.JSX.Element {
  const router = useRouter();
  const { navigateTo } = useNavigation();
  const currentPath = router.pathname;
  const { isConnected, subscribe } = useRealTime();
  const utils = trpc.useUtils();

  // Use polling only when WebSocket is disconnected
  const fallbackPollingInterval = isConnected ? false : 10000;

  const { data: pendingJobs } = trpc.jobs.getByStatus.useQuery(
    { status: 'pending' },
    { refetchInterval: fallbackPollingInterval }
  );

  const { data: activeJobs } = trpc.jobs.getByStatus.useQuery(
    { status: 'active' },
    { refetchInterval: fallbackPollingInterval }
  );

  const handleJobUpdate = useCallback((_event: WebSocketEvent) => {
    void utils.jobs.getByStatus.invalidate();
  }, [utils.jobs.getByStatus]);

  useEffect(() => {
    const unsubscribe = subscribe('jobs:active', handleJobUpdate);
    return unsubscribe;
  }, [subscribe, handleJobUpdate]);

  const taskStats = React.useMemo(() => {
    if (!pendingJobs && !activeJobs) return null;

    return {
      active: activeJobs?.length ?? 0,
      queued: pendingJobs?.length ?? 0,
    };
  }, [pendingJobs, activeJobs]);
  
  const handleRefresh = (): void => {
    void utils.jobs.getByStatus.invalidate();
  };

  const getActiveRoute = (): string => {
    const foundRoute = navItems.find(item => currentPath.includes(item.route));
    return foundRoute?.route ?? 'dashboard';
  };

  const activeRoute = getActiveRoute();

  return (
    <Box style={{ 
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: '#424242',
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      padding: '8px 16px',
      width: '100%',
    }}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {/* Left side - Navigation */}
        <Group gap="xs">
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            const IconComponent = item.icon;

            return (
              <Button
                key={item.route}
                variant={isActive ? 'filled' : 'subtle'}
                size="sm"
                leftSection={<IconComponent size={16} />}
                onClick={() => { void navigateTo(item.path); }}
                style={{ color: isActive ? undefined : '#dddddd' }}
              >
                {item.label}
              </Button>
            );
          })}
        </Group>

        {/* Right side - Actions and Stats */}
        <Group gap="xs">
          {/* Connection Status */}
          <Tooltip label={isConnected ? 'Real-time updates active' : 'Using fallback polling'}>
            <Badge
              color={isConnected ? 'green' : 'yellow'}
              variant="light"
              leftSection={isConnected ? <IconWifi size={12} /> : <IconWifiOff size={12} />}
              size="sm"
            >
              {isConnected ? 'Live' : 'Polling'}
            </Badge>
          </Tooltip>

          {/* Task Stats */}
          {taskStats && (
            <Group gap="xs">
              <Badge color="blue" variant="filled">
                {taskStats.active} Active
              </Badge>
              <Badge color="yellow" variant="filled">
                {taskStats.queued} Queued
              </Badge>
            </Group>
          )}

          {/* Refresh Button */}
          <Tooltip label="Refresh tasks">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => { void handleRefresh(); }}
              style={{ color: '#dddddd' }}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>
    </Box>
  );
}