/**
 * Batch Metadata Editor - Match Card Component
 *
 * Displays a single metadata provider match with:
 * - Cover image
 * - Title and provider badge
 * - Confidence score
 * - Year and description
 * - Selection radio button
 *
 * Extracted from: BatchMetadataEditor.tsx (lines 177-232)
 */

import React from 'react';

import { Card, Group, Radio, Badge, Box, Text, Image } from '@mantine/core';

import type { ProviderMatch } from '@/server/services/library/metadataEnrichmentService';

import { getProviderColor } from '../utils';

export interface MatchCardProps {
    match: ProviderMatch;
    isSelected: boolean;
    onSelect: () => void;
}

export function MatchCard({ match, isSelected, onSelect }: MatchCardProps): JSX.Element {
    const metadata = match.metadata && typeof match.metadata === 'object'
        ? match.metadata as Record<string, unknown>
        : null;
    const coverUrl = metadata?.['coverUrl'];
    const year = metadata?.['year'];
    const description = metadata?.['description'];

    const renderCoverImage = (): JSX.Element | null => {
        if (coverUrl && typeof coverUrl === 'string') {
            return (
                <Image
                    src={coverUrl}
                    width={40}
                    height={60}
                    radius="sm"
                    fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60' viewBox='0 0 40 60'%3E%3Crect width='40' height='60' fill='%23f0f0f0'/%3E%3C/svg%3E"
                />
            );
        }
        return null;
    };

    const renderYear = (): JSX.Element | null => {
        if (year && (typeof year === 'number' || typeof year === 'string')) {
            return <Text size="sm" c="dimmed">Year: {String(year)}</Text>;
        }
        return null;
    };

    const renderDescription = (): JSX.Element | null => {
        if (description && typeof description === 'string') {
            return <Text size="xs" c="dimmed" lineClamp={2} mt="xs">{description}</Text>;
        }
        return null;
    };

    return (
        <Card
            key={match.id}
            withBorder
            p="sm"
            style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined
            }}
            onClick={onSelect}
        >
            <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" style={{ flex: 1 }}>
                    <Radio value={match.id} checked={isSelected} onChange={onSelect} />
                    {renderCoverImage()}
                    <Box style={{ flex: 1 }}>
                        <Group gap="xs">
                            <Text fw={500} lineClamp={1}>{match.title}</Text>
                            <Badge size="sm" color={getProviderColor(match.provider)}>
                                {match.provider}
                            </Badge>
                        </Group>
                        {renderYear()}
                    </Box>
                </Group>
                <Badge
                    variant="light"
                    color={match.confidence >= 0.9 ? 'green' : match.confidence >= 0.7 ? 'yellow' : 'orange'}
                >
                    {Math.round(match.confidence * 100)}%
                </Badge>
            </Group>
            {renderDescription()}
        </Card>
    );
}
