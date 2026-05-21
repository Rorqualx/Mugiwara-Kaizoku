/**
 * Metadata Provider Card Component
 *
 * Individual card for a metadata provider. Toggle delegates to the per-provider
 * `setEnabled` passed from `useAllProviderConfigs` — no longer writes the
 * deprecated `metadata` JSON blob.
 */
import React, { useState, useEffect } from 'react';

import { Card, Group, Text, Switch, Collapse, LoadingOverlay, Stack, Badge } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

export interface MetadataProviderCardProps {
    providerId: string;
    providerName: string;
    enabled: boolean;
    setEnabled?: (value: boolean) => Promise<void>;
    settingsComponent?: React.ReactNode;
    isEditMode?: boolean;
    onEnableChange?: () => void;
    /**
     * One-shot expand/collapse signal from the parent. Each new `tick` value
     * forces this card's local `isExpanded` to match `value`, while still
     * letting the user toggle individually after. Undefined = parent isn't
     * driving expansion.
     */
    expandSignal?: { tick: number; value: boolean };
}

export function MetadataProviderCard({
    providerId,
    providerName,
    enabled: initialEnabled,
    setEnabled,
    settingsComponent,
    isEditMode = false,
    onEnableChange,
    expandSignal,
}: MetadataProviderCardProps): React.ReactElement {
    const [isEnabled, setIsEnabled] = useState(initialEnabled);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsEnabled(initialEnabled);
    }, [initialEnabled]);

    useEffect(() => {
        if (expandSignal === undefined) return;
        setIsExpanded(expandSignal.value);
    }, [expandSignal]);

    const handleToggleEnabled = async (): Promise<void> => {
        if (!setEnabled) return;
        const newEnabledState = !isEnabled;
        setIsLoading(true);
        setIsEnabled(newEnabledState);
        try {
            await setEnabled(newEnabledState);
            onEnableChange?.();
        } catch (error: unknown) {
            logger.error(`[MetadataProviderCard] Toggle failed for ${providerId}`, error);
            setIsEnabled(!newEnabledState);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card shadow="sm" padding="lg" radius="md" withBorder style={{ position: 'relative' }}>
            <LoadingOverlay
                visible={isLoading}
                overlayProps={{ blur: 2 }}
                loaderProps={{ 'aria-label': 'Updating provider settings' }}
            />

            <Stack gap="md">
                <Group justify="space-between" align="center">
                    <Group gap="sm">
                        <Text fw={500} size="lg">{providerName}</Text>
                        {isEnabled && <Badge color="green" size="sm">Active</Badge>}
                    </Group>
                    <Switch
                        checked={isEnabled}
                        onChange={() => { void handleToggleEnabled(); }}
                        disabled={isLoading || isEditMode || !setEnabled}
                        label={isEnabled ? 'Enabled' : 'Disabled'}
                        color="green"
                        size="md"
                        aria-label={`Toggle ${providerName} provider`}
                    />
                </Group>

                {isEnabled && settingsComponent && (
                    <>
                        <Group onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }} gap="xs">
                            <Text size="sm" fw={500}>Settings</Text>
                            {isExpanded ? <IconChevronUp size={16}/> : <IconChevronDown size={16}/>}
                        </Group>
                        <Collapse in={isExpanded}>
                            <Card.Section p="md" pt="sm" pb="md">
                                {React.isValidElement(settingsComponent)
                                    ? settingsComponent
                                    : <Text c="red">Error: invalid settings component</Text>}
                            </Card.Section>
                        </Collapse>
                    </>
                )}
            </Stack>
        </Card>
    );
}
