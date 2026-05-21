/**
 * Media Management Settings Page
 *
 * Provides a comprehensive interface for managing manga media files and libraries.
 * This page includes multiple components for configuring different aspects of
 * media management in the Kaizoku application.
 *
 * Features:
 * - File organization preferences for folder structure and naming
 * - Download settings and scheduling
 * - Path mapping for Docker and remote storage
 * - Ebook format support
 *
 * Note: File format preferences are configured in Settings > File Conversion.
 * Library management has been moved to Settings > Library.
 *
 * @module pages/settings/media-management
 * @requires @mantine/core - UI components
 * @requires @/components/settings/FileOrganizationSettings - File organization component
 * @requires @/components/settings/DownloadSettings - Download configuration component
 * @requires @/components/settings/PathMappingSettings - Path mapping component
 * @requires @/components/layouts/SettingsLayout - Settings page wrapper
 */

import React from 'react';
import type { ReactElement } from 'react';

import { Stack, Text, Divider, Skeleton } from '@mantine/core';
import dynamic from 'next/dynamic';

// Import actual components for full functionality
import ErrorBoundary from '@/components/common/UnifiedErrorBoundary';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';

// Dynamically import settings components with SSR disabled to avoid hydration issues
// These components use hooks that trigger state updates which can conflict with Suspense boundaries
const FileOrganizationSettings = dynamic(
  () => import('@/components/settings/FileOrganizationSettings').then(mod => ({ default: mod.FileOrganizationSettings })),
  { ssr: false, loading: () => <Skeleton height={200} radius="md" /> }
);

const DownloadSettings = dynamic(
  () => import('@/components/settings/DownloadSettings').then(mod => ({ default: mod.DownloadSettings })),
  { ssr: false, loading: () => <Skeleton height={200} radius="md" /> }
);

const PathMappingSettings = dynamic(
  () => import('@/components/settings/PathMappingSettings').then(mod => ({ default: mod.PathMappingSettings })),
  { ssr: false, loading: () => <Skeleton height={200} radius="md" /> }
);

const EbookFormatSettings = dynamic(
  () => import('@/components/settings/EbookFormatSettings').then(mod => ({ default: mod.EbookFormatSettings })),
  { ssr: false, loading: () => <Skeleton height={200} radius="md" /> }
);

const AudiobookFormatSettings = dynamic(
  () => import('@/components/settings/AudiobookFormatSettings').then(mod => ({ default: mod.AudiobookFormatSettings })),
  { ssr: false, loading: () => <Skeleton height={200} radius="md" /> }
);

const DownloadRetrySettings = dynamic(
  () => import('@/components/settings/DownloadRetrySettings').then(mod => ({ default: mod.DownloadRetrySettings })),
  { ssr: false, loading: () => <Skeleton height={200} radius="md" /> }
);

/**
 * Media Management Settings Page Component
 *
 * Renders a comprehensive settings page that combines file organization settings,
 * path mapping configuration, and library management.
 * Uses a stack layout to organize the different settings sections vertically.
 * Each section is wrapped in an ErrorBoundary for graceful error handling.
 *
 * @component
 * @example
 * ```tsx
 * // In router/navigation
 * <Route path="/settings/media-management" component={MediaManagementSettings} />
 * ```
 */
export default function MediaManagementSettings(): React.ReactElement {
  return (
    <SettingsLayout title="Media Management">
      {/* Main content stack with vertical spacing */}
      <Stack gap="lg">
        {/* Introduction section */}
        <Text size="sm" c="dimmed">
          Configure how Kaizoku manages your manga files, including
          file organization, download monitoring, path mapping, and library locations.
          For file format preferences, see Settings → File Conversion.
        </Text>
        
        <Divider />
        
        {/* File organization section */}
        <ErrorBoundary>
          <FileOrganizationSettings />
        </ErrorBoundary>

        {/* Download monitoring section */}
        <ErrorBoundary>
          <DownloadSettings />
        </ErrorBoundary>

        {/* Download retry section */}
        <ErrorBoundary>
          <DownloadRetrySettings />
        </ErrorBoundary>

        {/* Path mapping section */}
        <ErrorBoundary>
          <PathMappingSettings />
        </ErrorBoundary>

        {/* Ebook format support section */}
        <ErrorBoundary>
          <EbookFormatSettings />
        </ErrorBoundary>

        {/* Audiobook format support section */}
        <ErrorBoundary>
          <AudiobookFormatSettings />
        </ErrorBoundary>
      </Stack>
    </SettingsLayout>);

}

// Use MainLayout for this page to get the full navigation
MediaManagementSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

// Error Boundary implementation is imported from @/components/ErrorBoundary