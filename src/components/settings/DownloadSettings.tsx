/**
 * Global Monitoring Settings Component
 *
 * This component provides controls for configuring automatic monitoring settings,
 * using the central configuration system for persistence.
 *
 * Features:
 * - Automatic monitoring toggle
 * - Schedule interval selection with real persistence
 * - Custom cron expression support
 * - Retry attempt configuration
 *
 * Note: Download paths are configured in individual download clients, not here.
 */
import * as React from 'react';

import { Select, Text, Title, Paper, Stack, Divider, NumberInput, TextInput } from '@mantine/core';

import { useDownloadConfig } from '@/hooks/useDownloadConfig';
import type { DownloadModePreference } from '@/hooks/useDownloadConfig';

import { SettingsSwitch } from './SettingsSwitch';

/**
 * Global monitoring settings component with proper state management
 */
export const DownloadSettings: React.FC = () => {
    const { config, isLoading, saving, updateSetting } = useDownloadConfig();

    /**
     * Available interval options for the select component
     */
    const intervalData = [
        { value: 'never', label: 'Never' },
        { value: 'hourly', label: 'Every Hour' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'custom', label: 'Custom Schedule' }
    ] as const;

    /**
     * Handles changes to the monitoring interval
     */
    const handleIntervalChange = (value: string | null): void => {
        if (value && ['never', 'hourly', 'daily', 'weekly', 'monthly', 'custom'].includes(value)) {
            void updateSetting('interval', value as typeof config.interval);
        }
    };

    /**
     * Handles toggling automatic monitoring
     */
    const handleAutoDownloadToggle = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        await updateSetting('autoDownload', event.currentTarget.checked);
    };

    /**
     * Available download-mode options. Controls how the dispatcher balances
     * Prowlarr volume packs against chapter-granularity native sources.
     */
    const modeData = [
        { value: 'mix', label: 'Mix (default) — best of both' },
        { value: 'prefer-volume', label: 'Prefer volumes — bias toward volume packs' },
        { value: 'prefer-chapter', label: 'Prefer chapters — bias toward individual chapters' },
    ] as const;

    const handleModeChange = (value: string | null): void => {
        if (value === 'mix' || value === 'prefer-volume' || value === 'prefer-chapter') {
            void updateSetting('mode', value as DownloadModePreference);
        }
    };

    return (
        <Paper shadow="xs" p="xl" withBorder>
            <Title order={3} mb="md">Global Monitoring Settings</Title>

            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    Configure automatic monitoring and scheduling for new manga chapters.
                </Text>

                <Divider />

                {/* Automatic monitoring toggle */}
                <SettingsSwitch
                    label="Automatic Monitoring"
                    description="Enable automatic monitoring for new chapters"
                    checked={config.autoDownload}
                    onChange={(event) => { void handleAutoDownloadToggle(event); }}
                    disabled={isLoading || !!saving}
                />

                {/* Monitoring interval */}
                <Select
                    label="Monitoring Schedule"
                    description="How often to check for new chapters"
                    placeholder="Select schedule"
                    data={intervalData}
                    value={config.interval}
                    onChange={handleIntervalChange}
                    disabled={!config.autoDownload || isLoading || !!saving}
                />

                {/* Custom cron expression (if custom interval selected) */}
                {config.interval === 'custom' && (
                    <TextInput
                        label="Cron Expression"
                        description="Enter a custom cron expression for scheduling"
                        placeholder="0 0 * * *"
                        value={config.customCron ?? ''}
                        onChange={(e) => { void updateSetting('customCron', e.target.value); }}
                        disabled={!config.autoDownload || isLoading || !!saving}
                    />
                )}

                <Divider />

                {/* Retry attempts */}
                <NumberInput
                    label="Retry Attempts"
                    description="Number of retry attempts for failed operations"
                    min={0}
                    max={10}
                    value={config.retryAttempts}
                    onChange={(value) => {
                        if (typeof value === 'number') {
                            void updateSetting('retryAttempts', value);
                        }
                    }}
                    disabled={isLoading || !!saving}
                    style={{ maxWidth: '300px' }}
                />

                <Divider />

                {/* Download mode preference */}
                <Select
                    label="Download Mode"
                    description="How the dispatcher balances volume packs vs individual chapter downloads. Mix is the emergent default; prefer-volume biases scoring toward volume packs; prefer-chapter lets native chapter sources win even when Prowlarr packs cover them. All modes still complete the series — biased modes are soft preferences, not hard filters."
                    data={modeData}
                    value={config.mode}
                    onChange={handleModeChange}
                    disabled={isLoading || !!saving}
                    style={{ maxWidth: '500px' }}
                />
            </Stack>
        </Paper>
    );
};
