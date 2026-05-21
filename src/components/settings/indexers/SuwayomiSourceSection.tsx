/**
 * Suwayomi Source Section
 *
 * Renders the full Suwayomi configuration UI (server lifecycle + Mihon
 * extension catalog) inside the Indexers settings page. Suwayomi is treated
 * as a manga-source indexer here because what it really exposes is a catalog
 * of source extensions that surface manga listings; the download-side
 * surfaces lives in the Download Clients page as a thin status row.
 */
import React from 'react';

import { Anchor, Paper, Stack, Text, Title } from '@mantine/core';

import { ExtensionsTab } from '@/components/settings/suwayomi/ExtensionsTab';

export function SuwayomiSourceSection(): React.ReactElement {
  return (
    <Paper shadow="xs" p="xl" withBorder mb="xl">
      <Stack gap="xs" mb="md">
        <Title order={3}>Suwayomi (Mihon source extensions)</Title>
        <Text size="md" c="dimmed">
          Indexes manga from Mihon source extensions (WeebCentral, MangaFire,
          MangaPill, etc.). Browse the catalog and install / uninstall
          extensions below. The Suwayomi server itself starts/stops from{' '}
          <Anchor href="/settings/download-clients" size="md">Settings → Download Clients</Anchor>.
          Per-manga matching lives on each manga&apos;s detail page.
        </Text>
      </Stack>
      <ExtensionsTab />
    </Paper>
  );
}
