/**
 * AniList Integration Settings Component
 * 
 * This component provides a user interface for configuring AniList integration settings,
 * including API credentials, provider selection, and feature toggles.
 * 
 * Uses the centralized configuration system through the useAnilistConfig hook.
 */
import React from "react";

import {
  Box,
  Breadcrumbs,
  Group,
  Text,
  Paper,
  Title,
  Alert,
  Anchor,
  LoadingOverlay,
  Divider,
  Button,
  Badge,
  Stack } from
'@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconInfoCircle } from '@tabler/icons-react';

import { useAnilistConfig } from '@/hooks/useAnilistConfig';
import { useTheme } from '@/hooks/useTheme';

import classes from './integration.module.css';
import { TextItem } from './SettingsFormItems';
import { SettingsSwitch } from './SettingsSwitch';

/**
 * AniList settings configuration component
 * Uses the new configuration system for state management
 */
export function AnilistSettings(): React.ReactElement {
  // Use theme hook for consistency
  useTheme();

  // Use the specialized AniList configuration hook
  const {
    config,
    isLoading,
    saving,
    error: _error,
    updateSetting,
    updateConfig,
    refresh: _refresh
  } = useAnilistConfig();

  // Note: config is always defined (hook initializes with defaults)
  // LoadingOverlay on main Paper handles loading state

  return (
    <Paper p="md" withBorder style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading || !!saving} />
      <Title order={4} mb="md">AniList Integration</Title>
      
      <Alert icon={<IconInfoCircle size="1rem" />} title="AniList Integration" color="blue" mb="md">
        AniList provides comprehensive anime and manga metadata including titles, descriptions, genres, ratings, and cover images.
        <br />
        <Anchor href="https://anilist.co/settings/developer" target="_blank" rel="noopener noreferrer">
          Create an AniList API client
        </Anchor> to get your Client ID and Client Secret for enhanced features.
      </Alert>
      
      {/* Main toggle for AniList integration */}
      <Box className={classes['item']}>
        <SettingsSwitch
          label="Enable AniList Integration"
          description="Use AniList for manga metadata including titles, descriptions, genres, and cover images"
          checked={config.enabled}
          onChange={(event) => { void updateSetting("enabled", event.currentTarget.checked); }}
          disabled={isLoading || !!saving} />

      </Box>
      
      {config.enabled &&
      <Box className={classes['item']}>
          <SettingsSwitch
          label="Use for Metadata"
          description="Use AniList as a metadata provider for manga"
          checked={config.useForMetadata}
          onChange={(event) => { void updateSetting("useForMetadata", event.currentTarget.checked); }}
          disabled={isLoading || !!saving} />

        </Box>
      }
      
      {config.enabled && config.useForMetadata &&
      <>
        <Box className={classes['item']}>
          <SettingsSwitch
            label="Use Enhanced API Integration"
            description="Use direct AniList API for real-time data, user lists, and advanced features (requires API credentials)"
            checked={config.useEnhancedProvider}
            onChange={(event) => { void updateSetting("useEnhancedProvider", event.currentTarget.checked); }}
            disabled={isLoading || !!saving} />
        </Box>
        
        <Box className={classes['item']}>
          <SettingsSwitch
            label="Filter Adult Content"
            description="Block hentai and erotic results from AniList search and metadata"
            checked={config.filterAdultContent}
            onChange={(event) => { void updateSetting("filterAdultContent", event.currentTarget.checked); }}
            disabled={isLoading || !!saving} />
        </Box>

        <Divider my="md" label={<Group gap="xs"><Text size="sm">Experimental Filters</Text><Badge size="xs" color="yellow" variant="light">Under Development</Badge></Group>} labelPosition="center" />

        <Box className={classes['item']}>
          <Group gap="xs" mb={4}>
            <Text size="sm" fw={500}>Filter Webtoons</Text>
            <Badge size="xs" color="yellow" variant="light">Experimental</Badge>
          </Group>
          <SettingsSwitch
            label=""
            description="Exclude webtoon format (long vertical scroll comics) from search and home page results"
            checked={config.filterWebtoons}
            onChange={(event) => { void updateSetting("filterWebtoons", event.currentTarget.checked); }}
            disabled={isLoading || !!saving} />
        </Box>

        <Box className={classes['item']}>
          <Group gap="xs" mb={4}>
            <Text size="sm" fw={500}>Filter Korean Manhwa</Text>
            <Badge size="xs" color="yellow" variant="light">Experimental</Badge>
          </Group>
          <SettingsSwitch
            label=""
            description="Exclude Korean manhwa (Korean comics) from search and home page results"
            checked={config.filterKoreanManhwa}
            onChange={(event) => { void updateSetting("filterKoreanManhwa", event.currentTarget.checked); }}
            disabled={isLoading || !!saving} />
        </Box>
      </>
      }
      
      {/* API Credentials section */}
      <Divider my="md" label="API Credentials" labelPosition="center" />
      
      {config.useEnhancedProvider &&
      <Alert icon={<IconInfoCircle size="1rem" />} color="yellow" mb="md">
          Enhanced API integration requires your own AniList API credentials. This enables features like user list sync, 
          real-time updates, and higher rate limits.
        </Alert>
      }
      
      <Group align="center" className={`${classes['item']} ${classes['groupSpacing']}`} wrap="nowrap">
        <Box>
          <Breadcrumbs separator="/" classNames={{
            root: classes['breadcrumbRoot'],
            separator: classes['separator'],
            breadcrumb: classes['breadcrumb']
          }}>
            Client ID
          </Breadcrumbs>
          <Text size="xs" color="dimmed">
            AniList API Client ID
          </Text>
        </Box>
        <TextItem
          configKey="clientId"
          onUpdate={async (_, value: string) => { await updateSetting("clientId", value); }}
          initialValue={config.clientId} />

      </Group>

      <Group align="center" className={`${classes['item']} ${classes['groupSpacing']}`} wrap="nowrap">
        <Box>
          <Breadcrumbs separator="/" classNames={{
            root: classes['breadcrumbRoot'],
            separator: classes['separator'],
            breadcrumb: classes['breadcrumb']
          }}>
            Client Secret
          </Breadcrumbs>
          <Text size="xs" color="dimmed">
            AniList API Client Secret
          </Text>
        </Box>
        <TextItem
          configKey="clientSecret"
          onUpdate={async (_, value: string) => { await updateSetting("clientSecret", value); }}
          initialValue={config.clientSecret} />

      </Group>

      <Group align="center" className={`${classes['item']} ${classes['groupSpacing']}`} wrap="nowrap">
        <Box>
          <Breadcrumbs separator="/" classNames={{
            root: classes['breadcrumbRoot'],
            separator: classes['separator'],
            breadcrumb: classes['breadcrumb']
          }}>
            Access Token
          </Breadcrumbs>
          <Text size="xs" color="dimmed">
            AniList API Access Token (optional)
          </Text>
        </Box>
        <TextItem
          configKey="accessToken"
          onUpdate={async (_, value: string) => { await updateSetting("accessToken", value); }}
          initialValue={config.accessToken} />

      </Group>

      <Divider my="md" />

      <Stack gap="xs">
        <Text size="sm" fw={500}>Features</Text>
        <Group gap="xs">
          <Badge variant="light" color="green">No API Key Required (Basic)</Badge>
          <Badge variant="light" color="blue">GraphQL API</Badge>
          <Badge variant="light" color="cyan">Anime & Manga Database</Badge>
          <Badge variant="light" color="grape">User List Sync</Badge>
          <Badge variant="light" color="orange">Real-time Updates</Badge>
          <Badge variant="light" color="pink">Seasonal Charts</Badge>
        </Group>
      </Stack>

      <Group justify="flex-end" mt="xl">
        <Button
          onClick={() => { void updateConfig({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            accessToken: config.accessToken
          }); }}
          loading={isLoading}
          disabled={!!saving}
          aria-label="Save All AniList API credentials">

          Save All Credentials
        </Button>
      </Group>
    </Paper>);

}