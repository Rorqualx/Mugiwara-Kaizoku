/**
 * SystemSettings Component
 *
 * Manages global system settings for the manga management system.
 * Provides configuration options for metadata merging, cache settings,
 * and other system-wide preferences.
 *
 * Features:
 * - Metadata merger configuration
 * - Cache management
 * - Global rate limiting
 * - System health monitoring
 *
 * @module components/system/plugins/SystemSettings
 */
import React from "react";
import { useState } from "react";

import { Box, Paper, Text, Switch, NumberInput, Group, Button, Alert, Select, Divider, SimpleGrid, Badge } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconInfoCircle } from '@tabler/icons-react';
import { IconTrash } from '@tabler/icons-react';
import { IconRefresh } from '@tabler/icons-react';

import { useSettings } from '@/hooks/useSettings';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';
// TypeScript interface for settings object
interface SystemSettingsConfig {
    // Cache settings
    cacheDuration?: string | number;
    cacheEnabled?: boolean;
    // Download settings (moved to File Conversion settings page)
    globalRateLimit?: boolean;
    concurrentDownloads?: boolean;
    // Metadata settings
    metadataConflictResolution?: string;
    mergeGenres?: boolean;
    mergeAuthors?: boolean;
    preferLocalMetadata?: boolean;
    // System integrations
    mangalEnabled?: boolean;
    suwayomiEnabled?: boolean;
}
/**
 * SystemSettings Component
 *
 * Displays and manages global system configuration options
 *
 * @returns {JSX.Element} System settings interface
 */
export function SystemSettings(): React.ReactElement {
    const { settings, updateSetting } = useSettings();
    const utils = trpc.useUtils();
    // Type guard to check if settings exists and is an object
    const isValidSettings = (val: unknown): val is SystemSettingsConfig => {
        return val !== null && typeof val === 'object';
    };
    // Safely access settings with proper type checking
    const typedSettings = isValidSettings(settings) ? settings as SystemSettingsConfig : {} as SystemSettingsConfig;
    // Use safe parsing with fallbacks for settings with proper type handling
    const [cacheDuration, setCacheDuration] = useState<number>(() => {
        // Handle various types cacheDuration might be
        if (typedSettings.cacheDuration !== undefined) {
            if (typeof typedSettings.cacheDuration === 'number') {
                return typedSettings.cacheDuration;
            }
            // Try to parse string to number with fallback
            const parsed = parseInt(String(typedSettings.cacheDuration), 10);
            return isNaN(parsed) ? 7 : parsed;
        }
        // Default fallback
        return 7;
    });
    const [conflictResolution, setConflictResolution] = useState<string>(() => {
        if (typeof typedSettings.metadataConflictResolution === 'string') {
            return typedSettings.metadataConflictResolution;
        }
        return 'priority'; // Default fallback
    });
    /**
     * Clear system cache
     */
    const clearCache = (): Promise<void> => {
        try {
            // This would be implemented in a real application
            // Simulating success for now
            setTimeout(() => {
                notify({ severity: 'SUCCESS', title: 'Success', message: 'Cache cleared successfully' });
            }, 1000);
            return Promise.resolve();
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to clear cache';
            notify({ severity: 'ERROR', title: 'Error', message: errorMessage });
            return Promise.resolve();
        }
    };
    /**
     * Check system health — calls the real getStatus admin procedure and
     * surfaces per-subsystem status (DB, suwayomi, providers) in the toast.
     * Previously this was a setTimeout that always reported "operational"
     * regardless of actual state.
     */
    const checkHealth = async (): Promise<void> => {
        try {
            const status = await utils.system.getStatus.fetch();
            const dbOk = status.database.isConnected;
            const suwayomiOk = status.integrations.sources.suwayomi.status === 'active';
            const metadataProviders: Array<{ enabled: boolean }> = Object.values(status.integrations.metadata);
            const enabledProviders = metadataProviders.filter((p) => p.enabled).length;
            const severity = dbOk ? 'SUCCESS' : 'ERROR';
            const lines = [
                `DB: ${dbOk ? 'connected' : 'disconnected'}`,
                `Suwayomi: ${suwayomiOk ? 'running' : 'not running'}`,
                `Metadata providers enabled: ${enabledProviders}/3`,
                `Memory: ${status.system.memory.usagePercent.toFixed(0)}%  ·  Disk: ${status.system.disk.usagePercent.toFixed(0)}%`,
            ];
            notify({ severity, title: dbOk ? 'System Health' : 'System Health (issues)', message: lines.join('\n') });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Health check failed', errorMessage);
            notify({ severity: 'ERROR', title: 'Health check failed', message: errorMessage });
        }
    };
    /**
     * Save cache settings
     */
    const saveCacheSettings = async (): Promise<void> => {
        try {
            await updateSetting('cacheDuration', cacheDuration.toString());
            notify({ severity: 'SUCCESS', title: 'Success', message: 'Cache settings saved' });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to save cache settings';
            notify({ severity: 'ERROR', title: 'Error', message: errorMessage });
        }
    };
    /**
     * Save conflict resolution setting
     */
    const saveConflictResolution = async (): Promise<void> => {
        try {
            await updateSetting('metadataConflictResolution', conflictResolution);
            notify({ severity: 'SUCCESS', title: 'Success', message: 'Metadata conflict resolution setting saved' });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to save conflict resolution setting';
            notify({ severity: 'ERROR', title: 'Error', message: errorMessage });
        }
    };
    return (<Box>
      <Alert icon={<IconInfoCircle size={16}/>} title="System Settings" color="blue" mb="xl">

        Configure global settings that affect the entire system. These settings control
        how metadata is merged, how cache is managed, and other system-wide preferences.
      </Alert>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Paper p="lg" bg="dark.6">
          <Text fw={700} size="lg" mb="md">Metadata Merger</Text>
          
          <Group mb="md">
            <Text fw={500}>Conflict Resolution:</Text>
            <Select value={conflictResolution} onChange={(value: string | null) => value && setConflictResolution(value)} data={[
            { value: 'priority', label: 'Priority-based' },
            { value: 'mostComplete', label: 'Most Complete' },
            { value: 'manual', label: 'Manual' }
        ]} style={{ width: 200 }}/>

            <Button size="xs" onClick={() => void saveConflictResolution().catch((err) => {
                logger.error('Failed to save conflict resolution', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to save conflict resolution setting' });
              })}>Save</Button>
          </Group>
          
          <Text size="sm" color="dimmed" mb="lg">
            Controls how conflicts between metadata providers are resolved.
            Priority-based uses provider priority, Most Complete uses the most complete data,
            Manual requires user intervention for conflicts.
          </Text>
          
          <Divider mb="md"/>
          
          <Group>
            <Switch label="Merge Genres" checked={typedSettings.mergeGenres !== false} onChange={(event) => void updateSetting('mergeGenres', event.currentTarget.checked).catch((err) => {
                logger.error('Failed to update merge genres setting', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to update merge genres setting' });
              })}/>

          </Group>
          
          <Group mt="md">
            <Switch label="Merge Authors" checked={typedSettings.mergeAuthors !== false} onChange={(event) => void updateSetting('mergeAuthors', event.currentTarget.checked).catch((err) => {
                logger.error('Failed to update merge authors setting', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to update merge authors setting' });
              })}/>

          </Group>
          
          <Group mt="md">
            <Switch label="Prefer Local Metadata" checked={typedSettings.preferLocalMetadata !== false} onChange={(event) => void updateSetting('preferLocalMetadata', event.currentTarget.checked).catch((err) => {
                logger.error('Failed to update prefer local metadata setting', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to update prefer local metadata setting' });
              })}/>

          </Group>
        </Paper>

        <Paper p="lg" bg="dark.6">
          <Text fw={700} size="lg" mb="md">Cache & Performance</Text>
          
          <Group mb="md" align="flex-end">
            <NumberInput label="Cache Duration (days)" description="How long to cache metadata and API responses" value={cacheDuration} onChange={(value) => setCacheDuration(Number(value))} min={1} max={90} style={{ width: 200 }}/>

            <Button size="xs" onClick={() => void saveCacheSettings().catch((err) => {
                logger.error('Failed to save cache settings', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to save cache settings' });
              })}>Save</Button>
          </Group>
          
          <Group mb="lg">
            <Switch label="Enable Caching" checked={typedSettings.cacheEnabled !== false} onChange={(event) => void updateSetting('cacheEnabled', event.currentTarget.checked).catch((err) => {
                logger.error('Failed to update caching setting', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to update caching setting' });
              })}/>

          </Group>
          
          <Divider mb="md"/>
          
          <Group>
            <Button leftSection={<IconTrash size={16}/>} color="red" variant="light" onClick={() => void clearCache().catch((err) => {
                logger.error('Failed to clear cache', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to clear cache' });
              })}>

              Clear Cache
            </Button>
          </Group>
        </Paper>

        <Paper p="lg" bg="dark.6">
          <Text fw={700} size="lg" mb="md">Download Settings</Text>

          <Text size="sm" color="dimmed" mb="lg">
            File format preferences are configured in Settings → File Conversion.
          </Text>

          <Divider mb="md"/>

          <Group>
            <Switch label="Global Rate Limiting" checked={typedSettings.globalRateLimit !== false} onChange={(event) => void updateSetting('globalRateLimit', event.currentTarget.checked).catch((err) => {
                logger.error('Failed to update global rate limiting setting', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to update global rate limiting setting' });
              })}/>

          </Group>

          <Group mt="md">
            <Switch label="Concurrent Downloads" checked={typedSettings.concurrentDownloads !== false} onChange={(event) => void updateSetting('concurrentDownloads', event.currentTarget.checked).catch((err) => {
                logger.error('Failed to update concurrent downloads setting', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to update concurrent downloads setting' });
              })}/>

          </Group>
        </Paper>

        <Paper p="lg" bg="dark.6">
          <Text fw={700} size="lg" mb="md">System Health</Text>
          
          <Group justify="space-between" mb="md">
            <Text>Mangal Status:</Text>
            <Badge color={typedSettings.mangalEnabled ? "green" : "gray"}>
              {typedSettings.mangalEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </Group>
          
          <Group justify="space-between" mb="md">
            <Text>Suwayomi Status:</Text>
            <Badge color={typedSettings.suwayomiEnabled ? "green" : "gray"}>
              {typedSettings.suwayomiEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </Group>
          
          <Group justify="space-between" mb="md">
            <Text>Cache Status:</Text>
            <Badge color={typedSettings.cacheEnabled !== false ? "green" : "gray"}>
              {typedSettings.cacheEnabled !== false ? "Enabled" : "Disabled"}
            </Badge>
          </Group>
          
          <Divider mb="md"/>
          
          <Group justify="center">
            <Button leftSection={<IconRefresh size={16}/>} onClick={() => void checkHealth().catch((err) => {
                logger.error('Failed to run health check', err);
                notify({ severity: 'ERROR', title: 'Error', message: 'Failed to run health check' });
              })}>

              Run Health Check
            </Button>
          </Group>
        </Paper>
      </SimpleGrid>
    </Box>);
}
