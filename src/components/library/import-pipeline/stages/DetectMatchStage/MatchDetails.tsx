/**
 * MatchDetails (row cell) for DetectMatchStage.
 *
 * Renders the selected-match summary inside a row: cover thumbnail, provider
 * badge, status, and either "Already in library + N new" or chapter/volume
 * details. Extracted from index.tsx to keep that file under 500 lines.
 *
 * @module components/library/import-pipeline/stages/DetectMatchStage/MatchDetails
 */
import { type JSX } from 'react';

import { Badge, Group, Image, Text } from '@mantine/core';

import type { EnrichedProviderMatch, MatchedMangaItem } from '@/components/library/import-pipeline/types';

interface MatchMeta {
  coverImage: string | undefined;
  status: string | undefined;
  chapters: number | undefined;
  volumes: number | undefined;
  genres: string[] | undefined;
}

function getMatchMeta(match: EnrichedProviderMatch | null): MatchMeta {
  const empty: MatchMeta = { coverImage: undefined, status: undefined, chapters: undefined, volumes: undefined, genres: undefined };
  if (!match) return empty;
  const meta = match.metadata as Record<string, unknown> | undefined;
  if (!meta) return empty;
  return {
    coverImage: typeof meta['coverImage'] === 'string' ? meta['coverImage'] : undefined,
    status: typeof meta['status'] === 'string' ? meta['status'] : undefined,
    chapters: typeof meta['chapters'] === 'number' ? meta['chapters'] : undefined,
    volumes: typeof meta['volumes'] === 'number' ? meta['volumes'] : undefined,
    genres: Array.isArray(meta['genres']) ? (meta['genres'] as string[]) : undefined,
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  library: 'teal',
  anilist: 'blue',
  comicvine: 'orange',
  fandom: 'grape',
};

function MatchCoverPlaceholder(): JSX.Element {
  return (
    <div style={{ width: 44, height: 62, borderRadius: 4, backgroundColor: 'var(--mantine-color-dark-5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Text size="xs" c="dimmed">N/A</Text>
    </div>
  );
}

export function MatchDetails({ item }: { item: MatchedMangaItem }): JSX.Element {
  const match = item.selectedMatch;
  const meta = getMatchMeta(match);
  const isLibrary = match?.provider === 'library';

  if (!match) {
    return <Text size="sm" c="dimmed">{item.isSearching ? 'Searching...' : 'No match'}</Text>;
  }

  const providerColor = PROVIDER_COLORS[match.provider] ?? 'violet';
  const statusColor = meta.status === 'FINISHED' || meta.status === 'completed' ? 'green' : 'blue';

  const detailParts = isLibrary
    ? null
    : [
        meta.chapters !== undefined ? `${meta.chapters} ch` : null,
        meta.volumes !== undefined ? `${meta.volumes} vol` : null,
        meta.genres?.slice(0, 3).join(', '),
      ].filter(Boolean).join(' · ');

  return (
    <Group gap="sm" wrap="nowrap">
      {meta.coverImage
        ? <Image src={meta.coverImage} alt={match.title} w={44} h={62} fit="cover" radius="sm" />
        : <MatchCoverPlaceholder />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={500} lineClamp={1}>{match.title}</Text>
        <Group gap={4} mt={2}>
          <Badge size="xs" variant="filled" color={providerColor}>{match.provider.toUpperCase()}</Badge>
          {meta.status && <Badge size="xs" variant="light" color={statusColor}>{meta.status}</Badge>}
        </Group>
        {isLibrary ? (
          <Group gap={6} mt={2} wrap="nowrap">
            <Text size="xs" c="dimmed">
              Already in library{item.duplicateOfId ? ` · ID #${item.duplicateOfId}` : ''}
            </Text>
            {typeof item.newChapters === 'number' && item.newChapters > 0 && (
              <Badge size="xs" variant="filled" color="lime">+{item.newChapters} new</Badge>
            )}
          </Group>
        ) : (
          detailParts && <Text size="xs" c="dimmed" mt={2} lineClamp={1}>{detailParts}</Text>
        )}
      </div>
    </Group>
  );
}
