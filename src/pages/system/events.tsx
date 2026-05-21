/**
 * System Events Page
 *
 * Comprehensive system events monitoring dashboard with advanced filtering,
 * search, and export capabilities. Monitor API calls, downloads, metadata
 * updates, and manga events in real-time.
 *
 * @module pages/system/events
 */
import React from 'react';
import type { ReactElement } from 'react';

import { Title, Stack, Paper, Text, List } from '@mantine/core';
import { IconActivity, IconFilter, IconDownload, IconClock } from '@tabler/icons-react';

import { ErrorBoundary } from '@/components/common/UnifiedErrorBoundary';
import { EventsDashboard } from '@/components/events/EventsDashboard';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import { logger } from '@/utils/logger';

/**
 * System Events Page Component
 *
 * Main page for system event monitoring with comprehensive features:
 * - Real-time event updates with auto-refresh
 * - Advanced multi-criteria filtering (level, source, type, date range)
 * - Full-text search across event messages
 * - Event history browsing with pagination
 * - Detailed event viewer with actions
 * - Export to JSON/CSV for external analysis
 * - Mobile-responsive design
 */
export default function SystemEvents(): React.ReactElement {
  return (
    <SystemLayout title="System Events">
      <Stack gap="lg">
        <Paper shadow="xs" p="md" radius="md">
          {/* Page Header */}
          <Stack gap="md" mb="lg">
            <Title order={2}>System Events & Activity Log</Title>
            <Text c="dimmed">
              Monitor and analyze system activity across API calls, downloads,
              metadata updates, and manga operations. Filter events by severity,
              source, type, and date to troubleshoot issues and track system
              health.
            </Text>

            {/* Feature highlights */}
            <List
              size="sm"
              c="dimmed"
              icon={
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  •
                </span>
              }
            >
              <List.Item icon={<IconActivity size={16} />}>
                <strong>Real-time Monitoring:</strong> Live updates with
                configurable auto-refresh intervals
              </List.Item>
              <List.Item icon={<IconFilter size={16} />}>
                <strong>Advanced Filtering:</strong> Multi-select filters for
                level, source, type, and custom date ranges
              </List.Item>
              <List.Item icon={<IconDownload size={16} />}>
                <strong>Export Capabilities:</strong> Download filtered events in
                JSON or CSV format for external analysis
              </List.Item>
              <List.Item icon={<IconClock size={16} />}>
                <strong>Event History:</strong> Browse through paginated event
                history with full-text search
              </List.Item>
            </List>
          </Stack>

          {/* Events Dashboard */}
          <ErrorBoundary
            onError={(error, errorInfo) => {
              logger.error('[SystemEvents] Dashboard error:', error);
              logger.error('[SystemEvents] Error info:', errorInfo);
            }}
          >
            <EventsDashboard />
          </ErrorBoundary>
        </Paper>
      </Stack>
    </SystemLayout>
  );
}

// Use MainLayout for this page to get the full navigation
SystemEvents.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
