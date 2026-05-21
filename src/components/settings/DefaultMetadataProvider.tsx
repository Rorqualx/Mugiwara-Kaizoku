/**
 * Default Metadata Provider Component
 *
 * Displays a compact one-line summary of enabled metadata providers.
 * Reads from per-provider config keys via `useAllProviderConfigs` so the badge
 * tracks toggles in the providers grid in real time without going through the
 * deprecated `metadata` blob.
 */
import React, { useMemo } from "react";

import { Text, Group, Badge, Skeleton } from '@mantine/core';

import { useAllProviderConfigs } from '@/hooks/useAllProviderConfigs';

import { METADATA_PROVIDERS } from './metadata-providers';

export function DefaultMetadataProvider(): React.ReactElement {
    const providerConfigs = useAllProviderConfigs();
    const isLoading = METADATA_PROVIDERS.some((p) => providerConfigs[p.id]?.isLoading);

    const activeProviders = useMemo(
        () => METADATA_PROVIDERS.filter((p) => providerConfigs[p.id]?.enabled),
        [providerConfigs],
    );

    if (isLoading) {
        return (
            <Group gap="xs">
                <Text fw={500} size="sm">Active:</Text>
                <Skeleton height={22} width={200} radius="sm" />
            </Group>
        );
    }

    return (
        <Group gap="xs">
            <Text fw={500} size="sm">Active:</Text>
            {activeProviders.length > 0 ? (
                activeProviders.map((p) => (
                    <Badge key={p.id} color="green" size="sm">{p.name}</Badge>
                ))
            ) : (
                <Text size="sm" c="dimmed">No providers configured</Text>
            )}
        </Group>
    );
}
