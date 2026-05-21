/**
 * JobNav component for navigating between job pages
 *
 * Provides tabbed navigation for the Jobs section with proper organization:
 * - Active: Live jobs only (PENDING, ACTIVE, RETRYING)
 * - History: All jobs across all statuses
 * - Completed: Successfully completed jobs
 */
import React from 'react';

import { Tabs } from '@mantine/core';
import {
  IconPlayerPlay,
  IconClock,
  IconCheck
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export function JobNav(): React.ReactElement {
  const router = useRouter();
  const currentPath = router.pathname;

  // Determine active tab based on current path
  const getActiveTab = (): string => {
    if (currentPath === '/jobs/active') return 'active';
    if (currentPath === '/jobs/history') return 'history';
    if (currentPath === '/jobs/completed') return 'completed';
    return 'active';
  };

  return (
    <Tabs value={getActiveTab()} mb="xl">
      <Tabs.List>
        <Link href="/jobs/active" passHref legacyBehavior>
          <Tabs.Tab value="active" leftSection={<IconPlayerPlay size={16} />}>
            Active
          </Tabs.Tab>
        </Link>
        <Link href="/jobs/history" passHref legacyBehavior>
          <Tabs.Tab value="history" leftSection={<IconClock size={16} />}>
            History
          </Tabs.Tab>
        </Link>
        <Link href="/jobs/completed" passHref legacyBehavior>
          <Tabs.Tab value="completed" leftSection={<IconCheck size={16} />}>
            Completed
          </Tabs.Tab>
        </Link>
      </Tabs.List>
    </Tabs>
  );
}