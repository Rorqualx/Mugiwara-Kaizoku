/**
 * FieldProviderPreferences Component
 *
 * Manages field-level provider preferences for metadata enrichment.
 * Allows users to specify which provider should be used for each metadata field.
 *
 * @module components/settings/FieldProviderPreferences
 */
import React, { useState, useEffect, useMemo, JSX } from 'react';

import { Paper, Text, Table, Alert, LoadingOverlay, Stack, Divider, Box } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { METADATA_FIELDS, METADATA_PROVIDERS, FieldProviderPreferencesType } from '@/types/search.types';
import { isSuccess } from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client/index';

import {
  migratePreferences,
  getDefaultPreferences,
  showSaveSuccessNotification,
  showSaveErrorNotification
} from './field-provider-preferences-logic';
import { FieldProviderPreferencesFallbackMode, FallbackMode } from './FieldProviderPreferencesFallbackMode';
import { FieldProviderPreferencesHeader } from './FieldProviderPreferencesHeader';
import { PriorityOrderEditor } from './PriorityOrderEditor';

interface FieldProviderPreferencesProps {
    /**
     * Optional manga ID for manga-specific preferences
     */
    mangaId?: number;
    /**
     * Whether this is for global settings or manga-specific
     */
    isGlobal?: boolean;
    /**
     * Callback when preferences are updated
     */
    onUpdate?: (preferences: FieldProviderPreferencesType) => void;
}

export function FieldProviderPreferences({ mangaId, isGlobal = true, onUpdate }: FieldProviderPreferencesProps): JSX.Element {
    const [preferences, setPreferences] = useState<FieldProviderPreferencesType>({});
    const [fallbackMode, setFallbackMode] = useState<FallbackMode>('priority');
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [providerStatus, setProviderStatus] = useState<Record<string, boolean>>({});

    // Fetch actual provider status from the registry
    const { data: providersData } = trpc.search.getProviders.useQuery();

    // Get settings using batch endpoint to avoid rate limiting
    const { data: batchSettings } = trpc.settings.getBatch.useQuery({
        keys: ['fieldProviderPreferences.preferences', 'fieldProviderPreferences.fallbackMode']
    });

    // Extract individual settings from batch result and maintain isSuccess compatibility
    // Wrap in useMemo to prevent creating new objects on every render
    const preferencesSetting = useMemo(() => {
        return batchSettings && isSuccess(batchSettings)
            ? { ...batchSettings, data: (batchSettings.data as Record<string, unknown>)['fieldProviderPreferences.preferences'] ?? {} }
            : null;
    }, [batchSettings]);

    const fallbackModeSetting = useMemo(() => {
        return batchSettings && isSuccess(batchSettings)
            ? { ...batchSettings, data: (batchSettings.data as Record<string, unknown>)['fieldProviderPreferences.fallbackMode'] ?? 'priority' }
            : null;
    }, [batchSettings]);

    const updateSettingsBatch = trpc.settings.setBatch.useMutation();

    // Build provider status from API data
    const actualProviderStatus = useMemo(() => {
        const status: Record<string, boolean> = {};
        // Default all METADATA_PROVIDERS to true
        METADATA_PROVIDERS.forEach((provider) => {
            status[provider.value] = true;
        });
        // Override with actual status from API
        if (providersData) {
            providersData.forEach((provider) => {
                status[provider.id] = provider.status === 'active';
            });
        }
        return status;
    }, [providersData]);

    // Load current preferences
    useEffect(() => {
        // Load preferences and filter out disabled providers
        if (preferencesSetting && isSuccess(preferencesSetting)) {
            const savedPrefs = preferencesSetting.data as Record<string, string | string[]>;
            const migratedPrefs = Object.keys(savedPrefs).length > 0
                ? migratePreferences(savedPrefs)
                : getDefaultPreferences();

            // Filter out disabled providers from each field's priority list
            const filteredPrefs: FieldProviderPreferencesType = {};
            Object.keys(migratedPrefs).forEach((field) => {
                const fieldProviders = migratedPrefs[field] ?? [];
                filteredPrefs[field] = fieldProviders.filter(
                    (provider) => actualProviderStatus[provider] !== false
                );
            });
            setPreferences(filteredPrefs);
        }

        // Load fallback mode
        if (fallbackModeSetting && isSuccess(fallbackModeSetting)) {
            const mode = fallbackModeSetting.data;
            if (mode === 'priority' || mode === 'confidence') {
                setFallbackMode(mode);
            }
        }

        // Update provider status state for PriorityOrderEditor
        setProviderStatus(actualProviderStatus);
    }, [preferencesSetting, fallbackModeSetting, mangaId, isGlobal, actualProviderStatus]);

    const handleFieldProvidersChange = (field: string, providers: string[]): void => {
        setPreferences((prev) => ({
            ...prev,
            [field]: providers
        }));
        setIsDirty(true);
    };

    const handleFallbackModeChange = (mode: FallbackMode): void => {
        setFallbackMode(mode);
        setIsDirty(true);
    };

    const handleSave = async (): Promise<void> => {
        setIsLoading(true);
        try {
            // Atomic batch save - always enabled
            await updateSettingsBatch.mutateAsync({
                items: [
                    { key: 'fieldProviderPreferences.enabled', value: true },
                    { key: 'fieldProviderPreferences.preferences', value: preferences },
                    { key: 'fieldProviderPreferences.fallbackMode', value: fallbackMode }
                ]
            });

            showSaveSuccessNotification();
            setIsDirty(false);

            if (onUpdate) {
                onUpdate(preferences);
            }
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            showSaveErrorNotification(`Failed to save preferences: ${errorMessage}`);
        }
        finally {
            setIsLoading(false);
        }
    };

    const handleReset = (): void => {
        setPreferences(getDefaultPreferences());
        setIsDirty(true);
    };

    return (
      <Paper p="lg" withBorder style={{ position: 'relative' }}>
        <LoadingOverlay visible={isLoading}/>

        <Stack gap="md">
          <FieldProviderPreferencesHeader
            isDirty={isDirty}
            onReset={handleReset}
            onSave={() => void handleSave()}
          />

          <FieldProviderPreferencesFallbackMode
            mode={fallbackMode}
            onChange={handleFallbackModeChange}
          />

          <Alert variant="light" color="green" icon={<IconCheck size={16}/>}>
            <Text size="sm">
              Quick Add will use these provider preferences to automatically import manga. The manual import wizard always shows all available options for manual selection.
            </Text>
          </Alert>

          <Divider label="Field Mappings" labelPosition="center" />

          <Box style={{ display: 'flex', justifyContent: 'center' }}>
            <Table
              highlightOnHover
              verticalSpacing="sm"
              layout="fixed"
              styles={{
                table: {
                  tableLayout: 'fixed',
                  width: 'auto',
                },
                th: {
                  paddingLeft: 'var(--mantine-spacing-md)',
                  paddingRight: 'var(--mantine-spacing-md)',
                },
                td: {
                  paddingLeft: 'var(--mantine-spacing-md)',
                  paddingRight: 'var(--mantine-spacing-md)',
                  verticalAlign: 'middle',
                }
              }}
            >
              <colgroup>
                <col style={{ width: '150px' }} />
                <col style={{ width: '560px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', paddingRight: 'var(--mantine-spacing-lg)' }}>Metadata Field</th>
                  <th style={{ textAlign: 'left' }}>Priority Order (drag to reorder)</th>
                </tr>
              </thead>
              <tbody>
                {METADATA_FIELDS.map((field) => {
                  const currentProviders = preferences[field.value] ?? [];
                  return (
                    <tr key={field.value}>
                      <td style={{ textAlign: 'right', paddingRight: 'var(--mantine-spacing-lg)' }}>
                        <Text fw={500} size="sm">{field.label}</Text>
                      </td>
                      <td>
                        <PriorityOrderEditor
                          providers={currentProviders}
                          onChange={(providers) => handleFieldProvidersChange(field.value, providers)}
                          providerStatus={providerStatus}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Box>

          <Text size="xs" c="dimmed" mt="md">
            Providers marked with <IconCheck size={14} color="green" style={{ display: 'inline' }}/> are currently active.
            Providers marked with <IconAlertCircle size={14} color="red" style={{ display: 'inline' }}/> are currently unavailable.
          </Text>
        </Stack>
      </Paper>
    );
}
