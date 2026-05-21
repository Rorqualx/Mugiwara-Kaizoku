/**
 * Component for configuring manga monitoring settings
 * 
 * This component provides a form interface for configuring how a manga
 * should be monitored for updates, including storage location and update
 * intervals. It supports both predefined and custom monitoring schedules.
 * 
 * @remarks
 * Features:
 * - Library path selection
 * - Monitoring interval configuration
 * - Custom schedule support (cron expressions)
 * - Global settings override
 * - Manga preview with cover and titles
 * 
 * Monitoring Intervals:
 * - Never: No automatic monitoring
 * - Hourly: Check every hour
 * - Daily: Check every day
 * - Weekly: Check every week
 * - Monthly: Check every month
 * - Custom: User-defined cron schedule
 * 
 * Form Validation:
 * - Required library path
 * - Valid cron expression for custom schedules
 * - Disabled add button until requirements met
 * 
 * @example
 * ```tsx
 * // Basic usage with monitoring configuration
 * <MangaConfig
 *   manga={selectedManga}
 *   monitoringConfig={{
 *     interval: 'daily',
 *     overrideGlobal: false
 *   }}
 *   onUpdateConfig={(config) => handleConfigUpdate(config)}
 *   onSetLibraryPath={(path) => handlePathUpdate(path)}
 *   onAdd={() => handleAddManga()}
 *   libraryPath="/manga/library"
 * />
 * ```
 */
import React from "react";
import { useCallback } from 'react';

import {
  Card,
  Image,
  Text,
  Group,
  Stack,
  Button,
  Select,
  TextInput,
  Switch,
} from '@mantine/core';

import type { SearchResult, MonitoringConfig } from '@/server/services/search/types';

/**
 * Props for the MangaConfig component
 */
interface MangaConfigProps {
  /** Manga data to display and configure */
  manga: SearchResult;
  /** Current monitoring configuration */
  monitoringConfig: MonitoringConfig;
  /** Handler for updating monitoring configuration */
  onUpdateConfig: (config: Partial<MonitoringConfig>) => void;
  /** Handler for updating library path */
  onSetLibraryPath: (path: string) => void;
  /** Handler for adding manga with current configuration */
  onAdd: () => void;
  /** Current library path */
  libraryPath?: string;
}

/**
 * Available monitoring interval options
 * Each option defines a value and display label
 */
const MONITORING_INTERVALS = [
  { value: 'never', label: 'Never' },
  { value: 'hourly', label: 'Every Hour' },
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Every Week' },
  { value: 'monthly', label: 'Every Month' },
  { value: 'custom', label: 'Custom Schedule' },
];

export function MangaConfig({
  manga,
  monitoringConfig,
  onUpdateConfig,
  onSetLibraryPath,
  onAdd,
  libraryPath,
}: MangaConfigProps): React.ReactElement {
  /**
   * Handle monitoring interval change
   * Updates the monitoring configuration with new interval
   * 
   * @param value - Selected interval value
   */
  const handleIntervalChange = useCallback(
    (value: string | null) => {
      if (value) {
        onUpdateConfig({ interval: value as MonitoringConfig['interval'] });
      }
    },
    [onUpdateConfig]
  );

  /**
   * Handle global settings override toggle
   * Updates whether to use custom or global settings
   * 
   * @param event - Change event from switch component
   */
  const handleOverrideToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onUpdateConfig({ overrideGlobal: event.currentTarget.checked });
    },
    [onUpdateConfig]
  );

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Manga Preview Section */}
        <Group>
          <Image
            src={manga.cover ?? manga.coverImage ?? '/cover-not-found.jpg'}
            height={160}
            width={120}
            alt={manga["title"]}
            fallbackSrc="/cover-not-found.jpg"
          />
          <Stack style={{ flex: 1 }}>
            <Text size="lg" fw={500}>
              {manga["title"]}
            </Text>
            {manga["alternativeTitles"] && manga["alternativeTitles"].length > 0 && (
              <Text size="sm" c="dimmed">
                {manga["alternativeTitles"][0]}
              </Text>
            )}
          </Stack>
        </Group>

        {/* Library Path Input */}
        <TextInput
          label="Library Path"
          description="Select where to store the manga files"
          placeholder="/path/to/library"
          value={libraryPath ?? ''}
          onChange={(event) => onSetLibraryPath(event.currentTarget.value)}
          required
          data-autofocus
        />

        {/* Monitoring Interval Selection */}
        <Select
          label="Monitoring Interval"
          description="How often to check for updates"
          data={MONITORING_INTERVALS}
          value={monitoringConfig.interval}
          onChange={handleIntervalChange}
        />

        {/* Custom Schedule Input - Only shown for custom interval */}
        {monitoringConfig.interval === 'custom' && (
          <TextInput
            label="Custom Schedule"
            description="Enter a cron expression"
            placeholder="0 0 * * *"
            value={monitoringConfig.customInterval ?? ''}
            onChange={(event) =>
              onUpdateConfig({ customInterval: event.currentTarget.value })
            }
          />
        )}

        {/* Global Settings Override */}
        <Switch
          label="Override Global Settings"
          description="Use these monitoring settings instead of global defaults"
          checked={monitoringConfig.overrideGlobal}
          onChange={handleOverrideToggle}
        />

        {/* Action Buttons */}
        <Group justify="flex-end" mt="xl">
          <Button
            onClick={onAdd}
            disabled={!libraryPath}
            title={!libraryPath ? 'Library path is required' : undefined}
          >
            Add {manga["title"]}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
