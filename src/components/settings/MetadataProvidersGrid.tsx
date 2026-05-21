/**
 * Component for displaying and managing all available metadata providers
 *
 * Renders a grid of metadata provider cards. Enabled state for each provider
 * is read from its per-provider config key (`{provider}.enabled`) via
 * `useAllProviderConfigs` — no longer reads the deprecated `metadata` blob.
 */
import React, { useState } from 'react';

import { Title, Alert, Skeleton, Text, Stack, Group, Button } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconInfoCircle } from '@tabler/icons-react';

import { useAllProviderConfigs } from '@/hooks/useAllProviderConfigs';

import { AnilistSettings } from './AnilistSettings';
import { ComicVineSettings } from './ComicVineSettings';
import { FandomSettings } from './FandomSettings';
import { MalSettings } from './MalSettings';
import { MangaDexMetadataSettings } from './MangaDexMetadataSettings';
import { METADATA_PROVIDERS } from './metadata-providers';
import { MetadataProviderCard } from './MetadataProviderCard';
import { WikipediaSettings } from './WikipediaSettings';

export interface MetadataProvidersGridProps {
    /** Whether the component is in edit mode */
    isEditMode?: boolean;
    /** Callback when settings are changed */
    onChange?: () => void;
}

function getProviderSettingsComponent(providerId: string): JSX.Element | null {
    switch (providerId) {
        case 'fandom':
            return <FandomSettings />;
        case 'comicvine':
            return <ComicVineSettings />;
        case 'anilist':
            return <AnilistSettings />;
        case 'mangadex':
            return <MangaDexMetadataSettings />;
        case 'wikipedia':
            return <WikipediaSettings />;
        case 'mal':
            return <MalSettings />;
        case 'mangaupdates':
            return null;
        case 'kitsu':
            return null;
        default:
            return null;
    }
}

export function MetadataProvidersGrid({ isEditMode = false, onChange }: MetadataProvidersGridProps): React.ReactElement {
    const providerConfigs = useAllProviderConfigs();
    const anyLoading = METADATA_PROVIDERS.some((p) => providerConfigs[p.id]?.isLoading);
    const [expandSignal, setExpandSignal] = useState<{ tick: number; value: boolean } | undefined>(undefined);
    const handleExpandAll = (): void => {
        setExpandSignal((prev) => ({ tick: (prev?.tick ?? 0) + 1, value: true }));
    };
    const handleCollapseAll = (): void => {
        setExpandSignal((prev) => ({ tick: (prev?.tick ?? 0) + 1, value: false }));
    };

    if (anyLoading) {
        return (
            <Stack gap="md">
                <Title order={3}>Metadata Providers</Title>
                <Stack gap="md">
                    {[1, 2, 3, 4].map((index) => <Skeleton key={index} height={140} radius="md"/>)}
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack gap="md">
            <Group justify="space-between" align="center">
                <Title order={3}>Metadata Providers</Title>
                <Group gap="xs">
                    <Button variant="light" size="xs" leftSection={<IconChevronDown size={14} />} onClick={handleExpandAll}>
                        Expand all
                    </Button>
                    <Button variant="subtle" size="xs" leftSection={<IconChevronUp size={14} />} onClick={handleCollapseAll}>
                        Collapse all
                    </Button>
                </Group>
            </Group>

            <Alert icon={<IconInfoCircle size="1rem"/>} color="blue" mb="md">
                <Text size="sm">
                    Enable the metadata providers you want to use. When searching for manga,
                    all enabled providers will be queried to give you the best results.
                </Text>
            </Alert>

            <Stack gap="md">
                {METADATA_PROVIDERS.map((provider) => {
                    const entry = providerConfigs[provider.id];
                    const settingsComponent = getProviderSettingsComponent(provider.id);
                    return (
                        <MetadataProviderCard
                            key={provider.id}
                            providerId={provider.id}
                            providerName={provider.name}
                            enabled={entry?.enabled ?? false}
                            settingsComponent={settingsComponent}
                            isEditMode={isEditMode}
                            {...(expandSignal !== undefined ? { expandSignal } : {})}
                            {...(entry?.setEnabled ? { setEnabled: entry.setEnabled } : {})}
                            {...(onChange !== undefined ? { onEnableChange: onChange } : {})}
                        />
                    );
                })}
            </Stack>
        </Stack>
    );
}
