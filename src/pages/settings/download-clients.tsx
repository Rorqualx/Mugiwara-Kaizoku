/**
 * Download Clients Management Page
 *
 * Provides a comprehensive interface for configuring and managing download clients
 * used for automated manga downloading. Supports multiple client types including
 * torrent clients (Transmission, Deluge), Usenet clients (SABnzbd, NZBGet),
 * and integrations (Suwayomi).
 *
 * Features:
 * - Client-specific configuration panels
 * - Suwayomi server integration
 *
 * Note: Download preferences have been moved to Media Management settings.
 *
 * @module pages/settings/download-clients
 * @requires @mantine/core - UI components
 * @requires @tabler/icons-react - Icon components
 * @requires @/components/layouts/SettingsLayout - Page layout wrapper
 * @requires @/components/settings/downloadClients/* - Client-specific components
 */
import React from 'react';
import type { ReactElement } from 'react';

import {
  Container,
  Box,
  Text,
  Divider,
  Paper,
  Title } from
'@mantine/core';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import {
  DelugeTorrentSettings,
  NZBGetSettings,
  SABnzbdSettings,
  TransmissionSettings } from
'@/components/settings/downloadClients/ClientSettings';
import { NativeSourcesSection } from '@/components/settings/downloadClients/NativeSourcesSection';
import { SuwayomiServerControls } from '@/components/settings/suwayomi/SuwayomiServerControls';

/**
 * Download Clients Page Component
 *
 * Configures torrent / Usenet download clients (Transmission, Deluge,
 * SABnzbd, NZBGet) plus a thin Suwayomi status row pointing to Indexers
 * for the heavy Suwayomi config (server, extensions).
 */
function DownloadClientsPage(): React.ReactElement {
  return (
    <SettingsLayout title="Download Clients">
      <Container size="xl" py="xl">
        <Box mb="xl">
          <Text c="dimmed" mb="lg">
            Configure and manage your download clients for automatic downloading of manga.
            Each client has a test connection button to verify your settings are correct.
          </Text>
          <Divider mb="xl" />
        </Box>

        <NativeSourcesSection />

        <Paper shadow="xs" p="xl" withBorder mb="xl">
          <Title order={3} mb="lg">Download Client Configuration</Title>
          <Text mb="xl">
            Configure your download clients to enable automatic downloading of manga.
            Kaizoku supports Transmission and Deluge for torrents, and SABnzbd and NZBGet for Usenet.
          </Text>

          <TransmissionSettings />
          <DelugeTorrentSettings />
          <SABnzbdSettings />
          <NZBGetSettings />
        </Paper>

        <Paper shadow="xs" p="xl" withBorder mb="xl">
          <Title order={3} mb="lg">Suwayomi (Mihon source bridge)</Title>
          <SuwayomiServerControls />
        </Paper>
      </Container>
    </SettingsLayout>);

};

// Use MainLayout for this page to get the full navigation
DownloadClientsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

export default DownloadClientsPage;