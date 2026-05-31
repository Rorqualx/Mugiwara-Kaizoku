/**
 * Single card in the related-works carousel.
 *
 * Bound entries (toMangaId set) navigate to the in-app detail page on click.
 * Unbound entries open the AniList page in a new tab. ANIME/NOVEL targets are
 * cross-medium and always treated as external.
 */

'use client';

import { useCallback } from 'react';

import { Badge, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

import type { RelatedWorkEntry } from '@/server/trpc/routers/manga/relationsOperations';
import { proxyImageUrl } from '@/utils/image-proxy';

import { externalLinkFor, labelForMedium, labelForRelationType } from './relation-labels';

const CARD_WIDTH = 140;
const COVER_HEIGHT = 200;
const FALLBACK_COVER = '/cover-not-found.jpg';

interface RelatedWorkCardProps {
  entry: RelatedWorkEntry;
}

function coverSrc(entry: RelatedWorkEntry): string {
  if (entry.toMangaCover) {
    return proxyImageUrl(entry.toMangaCover) ?? entry.toMangaCover;
  }
  return FALLBACK_COVER;
}

export function RelatedWorkCard({ entry }: RelatedWorkCardProps): React.ReactElement {
  const router = useRouter();
  const typeLabel = labelForRelationType(entry.relationType);
  const mediumLabel = labelForMedium(entry.targetMedium);
  const externalUrl = externalLinkFor(entry.externalSource, entry.externalToId, entry.targetMedium);
  const isBound = entry.toMangaId !== null && entry.targetMedium === 'MANGA';

  const handleClick = useCallback((): void => {
    if (isBound && entry.toMangaId !== null) {
      router.push(`/manga/${entry.toMangaId}`);
      return;
    }
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
    }
  }, [isBound, entry.toMangaId, externalUrl, router]);

  const clickable = isBound || externalUrl !== null;
  const background = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${coverSrc(entry)})`;

  return (
    <Stack gap={4} w={CARD_WIDTH} style={{ flex: '0 0 auto' }}>
      <Paper
        onClick={clickable ? handleClick : undefined}
        shadow="sm"
        radius="md"
        h={COVER_HEIGHT}
        w={CARD_WIDTH}
        pos="relative"
        style={{
          cursor: clickable ? 'pointer' : 'default',
          overflow: 'hidden',
          backgroundColor: '#2a2a2a',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: background,
        }}
      >
        <Group gap={4} p={6} pos="absolute" top={0} left={0} right={0} wrap="nowrap">
          <Badge size="xs" color={typeLabel.color} variant="filled" radius="sm">
            {typeLabel.label}
          </Badge>
          {mediumLabel && (
            <Badge size="xs" color={mediumLabel.color} variant="filled" radius="sm">
              {mediumLabel.label}
            </Badge>
          )}
        </Group>
        {!isBound && externalUrl && (
          <Box pos="absolute" bottom={6} right={6} c="white" style={{ opacity: 0.85 }}>
            <IconExternalLink size={14} />
          </Box>
        )}
      </Paper>
      <Text size="xs" c="gray.3" lineClamp={2} style={{ maxWidth: CARD_WIDTH, lineHeight: 1.2 }}>
        {entry.targetTitle}
      </Text>
    </Stack>
  );
}
