/**
 * Browse Manga Card
 *
 * Shared card component for author, publisher, and genre browse pages.
 * Displays cover, title, status, score, author, and chapter count.
 */

import React from 'react';

import { Badge, Group, Image, Paper, Stack, Text } from '@mantine/core';
import { IconStar } from '@tabler/icons-react';
import Link from 'next/link';

import { getCoverUrl } from '@/utils/cover-url';

export interface BrowseManga {
  id: number;
  title: string;
  Metadata: {
    cover: string;
    coverLarge?: string | null;
    status?: string | null;
    chapters?: number | null;
    volumes?: number | null;
    authors?: string[];
    artists?: string[];
    publisher?: string | null;
    genres?: string[];
    averageScore?: number | null;
    summary?: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'green', RELEASING: 'blue', ONGOING: 'blue',
  HIATUS: 'yellow', CANCELLED: 'red', NOT_YET_RELEASED: 'gray',
};

function getSecondary(meta: BrowseManga['Metadata'], field: string): string | undefined {
  if (field === 'author') return meta?.authors?.[0];
  if (field === 'publisher') return meta?.publisher ?? undefined;
  return undefined;
}

function formatCount(chapters?: number | null, volumes?: number | null): string {
  const parts: string[] = [];
  if (chapters) parts.push(`${chapters} ch`);
  if (volumes) parts.push(`${volumes} vol`);
  return parts.join(' · ');
}

interface BrowseMangaCardProps {
  manga: BrowseManga;
  secondaryField?: 'author' | 'publisher' | 'none';
}

export function BrowseMangaCard({ manga, secondaryField = 'author' }: BrowseMangaCardProps): React.ReactElement {
  const cover = getCoverUrl(manga.Metadata, manga.id);
  const meta = manga.Metadata;
  const status = meta?.status;
  const score = meta?.averageScore;
  const secondary = getSecondary(meta, secondaryField);
  const countText = formatCount(meta?.chapters, meta?.volumes);

  return (
    <Link href={`/manga/${manga.id}`} style={{ textDecoration: 'none' }}>
      <Paper shadow="sm" radius="md" style={{ overflow: 'hidden', cursor: 'pointer' }}>
        <div style={{ position: 'relative' }}>
          <Image src={cover} alt={manga.title} h={270} fit="cover" />
          {score !== null && score !== undefined && score > 0 && (
            <Badge size="sm" variant="filled" color="dark"
              style={{ position: 'absolute', top: 6, right: 6, opacity: 0.9 }}
              leftSection={<IconStar size={10} />}>
              {(score / 10).toFixed(1)}
            </Badge>
          )}
        </div>
        <Stack gap={4} p="xs">
          <Text size="sm" fw={600} lineClamp={2}>{manga.title}</Text>
          <Group gap="xs">
            {status && (
              <Badge size="xs" variant="light" color={STATUS_COLORS[status] ?? 'gray'}>{status}</Badge>
            )}
            {countText && <Text size="xs" c="dimmed">{countText}</Text>}
          </Group>
          {secondary && <Text size="xs" c="dimmed" lineClamp={1}>{secondary}</Text>}
        </Stack>
      </Paper>
    </Link>
  );
}
