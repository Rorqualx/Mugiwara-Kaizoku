/**
 * MyAnimeList (Jikan) Settings
 *
 * Minimal settings panel — Jikan is a free, no-auth API so the only
 * user-facing control is the adult-content filter. Mirrors the layout
 * of AnilistSettings' "Filter Adult Content" section.
 */
import React from 'react';

import { Box, LoadingOverlay, Paper, Title, Alert, Anchor } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { useMalConfig } from '@/hooks/useMalConfig';

import classes from './integration.module.css';
import { SettingsSwitch } from './SettingsSwitch';

export function MalSettings(): React.ReactElement {
  const { config, isLoading, saving, updateSetting } = useMalConfig();

  return (
    <Paper p="md" withBorder style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading || !!saving} />
      <Title order={4} mb="md">MyAnimeList Integration</Title>

      <Alert icon={<IconInfoCircle size="1rem" />} color="blue" mb="md">
        MyAnimeList (via the free{' '}
        <Anchor href="https://jikan.moe" target="_blank" rel="noopener noreferrer">Jikan API</Anchor>)
        supplements AniList data when chapter/volume counts or publication status are missing.
        No API key required.
      </Alert>

      <Box className={classes['item']}>
        <SettingsSwitch
          label="Filter Adult Content"
          description="Block hentai and erotica matches from MAL. When enabled, a title flagged by MAL's explicit_genres is discarded instead of flowing into Metadata."
          checked={config.filterAdultContent}
          onChange={(event) => {
            void updateSetting('filterAdultContent', event.currentTarget.checked);
          }}
          disabled={isLoading || !!saving}
        />
      </Box>
    </Paper>
  );
}
