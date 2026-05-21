/**
 * Related Series & Recommendations Section
 *
 * Displays related series (sequels, prequels, spin-offs) and
 * recommendations from MangaUpdates data stored in providerMetadata.
 */

import React from 'react';

import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconArrowRight, IconLink, IconStar } from '@tabler/icons-react';
import Link from 'next/link';

import { trpc } from '@/utils/trpc-client';

interface RelatedSeriesSectionProps {
  mangaId: number;
}

const RELATION_COLORS: Record<string, string> = {
  Sequel: 'blue', Prequel: 'violet', 'Spin-Off': 'teal',
  'Side Story': 'cyan', Alternative: 'orange',
};

export function RelatedSeriesSection({ mangaId }: RelatedSeriesSectionProps): React.ReactElement | null {
  const { data } = trpc.browse.getRelatedAndRecommendations.useQuery({ mangaId });

  if (!data) return null;
  const hasRelated = data.relatedSeries.length > 0;
  const hasRecs = data.recommendations.length > 0;
  if (!hasRelated && !hasRecs) return null;

  return (
    <Stack gap="lg" mt="lg">
      {hasRelated && (
        <RelatedList items={data.relatedSeries} />
      )}
      {hasRecs && (
        <RecommendationList items={data.recommendations.slice(0, 10)} />
      )}
      {data.animeMapping && (
        <AnimeMapping start={data.animeMapping.start} end={data.animeMapping.end} />
      )}
    </Stack>
  );
}

function RelatedList({ items }: { items: Array<{ name: string; type: string; localMangaId: number | null }> }): React.ReactElement {
  return (
    <div>
      <Group gap="xs" mb="sm">
        <IconLink size={20} />
        <Title order={4}>Related Series</Title>
      </Group>
      <Stack gap="xs">
        {items.map((r, i) => (
          <SeriesCard key={`${r.name}-${i}`} name={r.name} badge={r.type} badgeColor={RELATION_COLORS[r.type] ?? 'gray'} localMangaId={r.localMangaId} />
        ))}
      </Stack>
    </div>
  );
}

function RecommendationList({ items }: { items: Array<{ name: string; weight: number; localMangaId: number | null }> }): React.ReactElement {
  return (
    <div>
      <Group gap="xs" mb="sm">
        <IconStar size={20} />
        <Title order={4}>Recommendations</Title>
      </Group>
      <Stack gap="xs">
        {items.map((r, i) => (
          <SeriesCard key={`${r.name}-${i}`} name={r.name} subtitle={`${r.weight} votes`} localMangaId={r.localMangaId} />
        ))}
      </Stack>
    </div>
  );
}

function SeriesCard({ name, badge, badgeColor = 'gray', subtitle, localMangaId }: {
  name: string; badge?: string; badgeColor?: string; subtitle?: string; localMangaId: number | null;
}): React.ReactElement {
  const content = (
    <Paper p="xs" radius="sm" withBorder style={{ cursor: localMangaId ? 'pointer' : 'default' }}>
      <Group gap="sm" justify="space-between">
        <Group gap="sm">
          {badge && <Badge size="sm" variant="light" color={badgeColor}>{badge}</Badge>}
          <Text size="sm" fw={500}>{name}</Text>
        </Group>
        <Group gap="xs">
          {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
          {localMangaId && <Badge size="xs" color="green">In Library</Badge>}
          {localMangaId && <IconArrowRight size={14} />}
        </Group>
      </Group>
    </Paper>
  );

  if (localMangaId) {
    return <Link href={`/manga/${localMangaId}`} style={{ textDecoration: 'none' }}>{content}</Link>;
  }
  return content;
}

function AnimeMapping({ start, end }: { start: string; end: string }): React.ReactElement {
  return (
    <Paper p="sm" radius="md" withBorder>
      <Text size="sm" fw={500}>Anime Adaptation</Text>
      <Text size="xs" c="dimmed" mt={4}>Start: {start || 'N/A'}</Text>
      <Text size="xs" c="dimmed">End: {end || 'N/A'}</Text>
    </Paper>
  );
}
