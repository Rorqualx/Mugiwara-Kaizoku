/**
 * Event Settings Component
 *
 * This component provides controls for configuring event logging and notification
 * preferences within the application. It includes settings for different event
 * types and severity levels.
 *
 * Features:
 * - Log level configuration for different event types
 * - Notification settings for various events
 * - Retention policy configuration
 * - Form validation for settings
 * - Real-time persistence via tRPC
 */
import React, { useEffect } from 'react';

import { Box, Button, Select, Title, Text, Stack, Group, Paper, Divider, NumberInput, LoadingOverlay, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import { SettingsSwitch } from './SettingsSwitch';

// Log level options for event types
const logLevelOptions = [
    { value: 'debug', label: 'Debug' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'critical', label: 'Critical' }
];

// Retention policy options
const retentionPolicyOptions = [
    { value: 'time', label: 'By Time (days)' },
    { value: 'count', label: 'By Count (max events)' },
    { value: 'both', label: 'Both (time and count)' },
    { value: 'unlimited', label: 'Unlimited' }
];

// Form values interface matching backend schema
interface EventSettingsFormValues {
    retentionPolicy: 'time' | 'count' | 'both' | 'unlimited';
    retentionDays: number;
    retentionCount: number;
    notificationsEnabled: boolean;
    notifyOnError: boolean;
    notifyOnWarning: boolean;
    notifyOnInfo: boolean;
    notifyOnDownloadComplete: boolean;
    notifyOnImportComplete: boolean;
    defaultLogLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical';
    componentLogLevels: Record<string, 'debug' | 'info' | 'warning' | 'error' | 'critical'>;
}

// Default form values
const defaultValues: EventSettingsFormValues = {
    retentionPolicy: 'time',
    retentionDays: 30,
    retentionCount: 5000,
    notificationsEnabled: true,
    notifyOnError: true,
    notifyOnWarning: true,
    notifyOnInfo: false,
    notifyOnDownloadComplete: true,
    notifyOnImportComplete: true,
    defaultLogLevel: 'info',
    componentLogLevels: {}
};

/**
 * Event settings form component
 *
 * @returns The event settings component
 */
export function EventSettings(): React.ReactElement {
    // Fetch event settings from backend
    const { data: settingsData, isLoading, error: fetchError } = trpc.events.getEventSettings.useQuery();

    // Update mutation
    const updateMutation = trpc.events.updateEventSettings.useMutation({
        onSuccess: () => {
            notify({ severity: 'SUCCESS', title: 'Settings saved', message: 'Event settings have been updated successfully' });
        },
        onError: (error: { message?: string }) => {
            notify({ severity: 'ERROR', title: 'Error saving settings', message: error.message ?? 'Failed to save event settings' });
        }
    });

    // Form initialization with default values
    const form = useForm<EventSettingsFormValues>({
        initialValues: defaultValues,
        validateInputOnBlur: false,
        validateInputOnChange: false
    });

    // Update form when settings are loaded
    useEffect(() => {
        if (settingsData) {
            // API response may not have all fields, so treat as partial
            const typedData = settingsData as Partial<EventSettingsFormValues>;
            form.setValues({
                retentionPolicy: typedData.retentionPolicy ?? defaultValues.retentionPolicy,
                retentionDays: typedData.retentionDays ?? defaultValues.retentionDays,
                retentionCount: typedData.retentionCount ?? defaultValues.retentionCount,
                notificationsEnabled: typedData.notificationsEnabled ?? defaultValues.notificationsEnabled,
                notifyOnError: typedData.notifyOnError ?? defaultValues.notifyOnError,
                notifyOnWarning: typedData.notifyOnWarning ?? defaultValues.notifyOnWarning,
                notifyOnInfo: typedData.notifyOnInfo ?? defaultValues.notifyOnInfo,
                notifyOnDownloadComplete: typedData.notifyOnDownloadComplete ?? defaultValues.notifyOnDownloadComplete,
                notifyOnImportComplete: typedData.notifyOnImportComplete ?? defaultValues.notifyOnImportComplete,
                defaultLogLevel: typedData.defaultLogLevel ?? defaultValues.defaultLogLevel,
                componentLogLevels: typedData.componentLogLevels ?? defaultValues.componentLogLevels
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run when settingsData changes
    }, [settingsData]);

    const handleSubmit = (values: EventSettingsFormValues): void => {
        updateMutation.mutate(values);
    };

    // Get component log level keys for dynamic rendering
    const componentKeys = Object.keys(form.values.componentLogLevels);

    return (
        <Box pos="relative">
            <LoadingOverlay visible={isLoading} />

            {fetchError && (
                <Alert icon={<IconAlertCircle size={16} />} title="Error loading settings" color="red" mb="md">
                    {fetchError.message}
                </Alert>
            )}

            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="lg">
                    {/* Retention Policy Section */}
                    <Paper withBorder p="md">
                        <Stack gap="md">
                            <Title order={3}>Retention Policy</Title>

                            <Divider />

                            <Text size="sm" c="dimmed">
                                Configure how long event logs are kept
                            </Text>

                            <Select
                                label="Retention Policy"
                                data={retentionPolicyOptions}
                                {...form.getInputProps('retentionPolicy')}
                            />

                            {(form.values.retentionPolicy === 'time' || form.values.retentionPolicy === 'both') && (
                                <NumberInput
                                    label="Retention Days"
                                    description="Number of days to keep events"
                                    min={1}
                                    max={365}
                                    {...form.getInputProps('retentionDays')}
                                />
                            )}

                            {(form.values.retentionPolicy === 'count' || form.values.retentionPolicy === 'both') && (
                                <NumberInput
                                    label="Maximum Events"
                                    description="Maximum number of events to keep"
                                    min={100}
                                    max={100000}
                                    {...form.getInputProps('retentionCount')}
                                />
                            )}
                        </Stack>
                    </Paper>

                    {/* Notifications Section */}
                    <Paper withBorder p="md">
                        <Stack gap="md">
                            <Title order={3}>Notifications</Title>

                            <Divider />

                            <SettingsSwitch
                                checked={form.values.notificationsEnabled}
                                onChange={(event) => form.setFieldValue('notificationsEnabled', event.currentTarget.checked)}
                                label="Enable Notifications"
                                description="Enable or disable all event notifications"
                            />

                            <Divider />

                            <Stack gap="md">
                                <SettingsSwitch
                                    checked={form.values.notifyOnError}
                                    onChange={(event) => form.setFieldValue('notifyOnError', event.currentTarget.checked)}
                                    disabled={!form.values.notificationsEnabled}
                                    label="Notify on Errors"
                                    description="Notify when errors occur"
                                />

                                <SettingsSwitch
                                    checked={form.values.notifyOnWarning}
                                    onChange={(event) => form.setFieldValue('notifyOnWarning', event.currentTarget.checked)}
                                    disabled={!form.values.notificationsEnabled}
                                    label="Notify on Warnings"
                                    description="Notify when warnings occur"
                                />

                                <SettingsSwitch
                                    checked={form.values.notifyOnInfo}
                                    onChange={(event) => form.setFieldValue('notifyOnInfo', event.currentTarget.checked)}
                                    disabled={!form.values.notificationsEnabled}
                                    label="Notify on Info"
                                    description="Notify on informational events"
                                />

                                <SettingsSwitch
                                    checked={form.values.notifyOnDownloadComplete}
                                    onChange={(event) => form.setFieldValue('notifyOnDownloadComplete', event.currentTarget.checked)}
                                    disabled={!form.values.notificationsEnabled}
                                    label="Download Complete"
                                    description="Notify when downloads complete"
                                />

                                <SettingsSwitch
                                    checked={form.values.notifyOnImportComplete}
                                    onChange={(event) => form.setFieldValue('notifyOnImportComplete', event.currentTarget.checked)}
                                    disabled={!form.values.notificationsEnabled}
                                    label="Import Complete"
                                    description="Notify when imports complete"
                                />
                            </Stack>
                        </Stack>
                    </Paper>

                    {/* Log Levels Section */}
                    <Paper withBorder p="md">
                        <Stack gap="md">
                            <Title order={3}>Log Levels</Title>

                            <Divider />

                            <Text size="sm" c="dimmed">
                                Configure log levels for different types of events
                            </Text>

                            <Select
                                label="Default Log Level"
                                description="Default log level for all components"
                                data={logLevelOptions}
                                {...form.getInputProps('defaultLogLevel')}
                            />

                            {componentKeys.length > 0 && (
                                <>
                                    <Divider label="Component-specific Levels" labelPosition="center" />

                                    <Stack gap="md">
                                        {componentKeys.map((key) => (
                                            <Box key={key}>
                                                <Text mb="xs" tt="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()} Events</Text>
                                                <Select
                                                    data={logLevelOptions}
                                                    value={form.values.componentLogLevels[key] ?? null}
                                                    onChange={(value) => {
                                                        if (value) {
                                                            form.setFieldValue(`componentLogLevels.${key}`, value as 'debug' | 'info' | 'warning' | 'error' | 'critical');
                                                        }
                                                    }}
                                                />
                                            </Box>
                                        ))}
                                    </Stack>
                                </>
                            )}
                        </Stack>
                    </Paper>

                    <Group justify="flex-end">
                        <Button
                            type="submit"
                            loading={updateMutation.isPending}
                        >
                            Save Settings
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Box>
    );
}
