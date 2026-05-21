/**
 * Import Manga Page (lives under /settings/library for legacy URL stability)
 *
 * Hosts the 4-stage import pipeline (select → detect/match → review → import).
 * Despite the URL, this is not a library-settings UI — it's the importer.
 * A future refactor may move it to /library/import; for now the page header
 * tells the truth about what the user is looking at.
 */

import React from 'react';
import type { ReactElement } from 'react';

import {
  Container,
  Stack,
  Text,
} from '@mantine/core';
import dynamic from 'next/dynamic';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';

// Dynamic import with error boundary for LibraryManagementSettings
const LibraryManagementSettings = dynamic(
  () =>
    import('@/components/library/LibraryManagementSettings').then(
      (mod) => mod.LibraryManagementSettings
    ),
  {
    loading: () => <Text>Loading library management...</Text>,
    ssr: false,
  }
);

/**
 * Library Settings Page Component
 *
 * Provides a dedicated page for managing library settings including:
 * - Library locations and root folders
 * - Scanning options and schedules
 * - File matching and organization
 */
function ImportMangaPage(): React.ReactElement {
  return (
    <SettingsLayout title="Import Manga">
      <Container size="xl" px={0}>
        <Stack gap="lg">
          <Text c="dimmed" size="sm">
            Scan a directory for manga files, match them against metadata providers,
            and import them into a target library.
          </Text>

          <LibraryManagementSettings />
        </Stack>
      </Container>
    </SettingsLayout>
  );
}

export default ImportMangaPage;

ImportMangaPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
