/**
 * Phase 4 v2-F — reading-order chain (v1).
 *
 * Renders a focused, reading-flow view of MangaRelation: parents/prequels
 * on the left, the current manga in the middle (highlighted), sequel on
 * the right, with side-story / spin-off / alternative entries branched
 * below.
 *
 * Filters out CHARACTER / COMPILATION / SUMMARY / ADAPTATION /
 * CONTAINS / SOURCE / OTHER — those aren't part of the reading sequence
 * (they're already covered by v2-B's flat related-works carousel).
 *
 * Multi-level traversal (depth > 1) is deferred — the live library has
 * only one bound MangaRelation today (Code Geass Oz Reflection -> O2),
 * so multi-hop adds no observable value yet. When data density improves
 * we can introduce a tRPC manga.getRelationGraph(mangaId, depth) and
 * render multiple hops on each side.
 */

'use client';

import { useCallback, useMemo } from 'react';

import { Badge, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconArrowRight, IconBookmark, IconExternalLink } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

import type { RelatedWorkEntry } from '@/server/trpc/routers/manga/relationsOperations';
import { proxyImageUrl } from '@/utils/image-proxy';
import { trpc } from '@/utils/trpc-client/index';

import type { MangaRelationType } from '@prisma/client';

const TYPES_BEFORE: MangaRelationType[] = ['PARENT', 'PREQUEL'];
const TYPES_AFTER: MangaRelationType[] = ['SEQUEL'];
const TYPES_BRANCH: MangaRelationType[] = ['SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE'];
const READING_FLOW_TYPES = new Set<MangaRelationType>([
  ...TYPES_BEFORE, ...TYPES_AFTER, ...TYPES_BRANCH,
]);

const CARD_WIDTH = 130;
const COVER_HEIGHT = 180;
const FALLBACK_COVER = '/cover-not-found.jpg';

interface ReadingOrderChainProps {
  mangaId: number;
  currentTitle: string;
  currentCover: string | null;
}

interface NodeProps {
  entry: RelatedWorkEntry;
  emphasis: 'before' | 'after' | 'branch';
}

function externalLinkFor(source: string, externalId: string): string | null {
  if (source === 'anilist') return `https://anilist.co/manga/${externalId}`;
  return null;
}

function coverSrc(url: string | null): string {
  if (!url) return FALLBACK_COVER;
  return proxyImageUrl(url) ?? url;
}

function relationLabel(t: MangaRelationType): string {
  if (t === 'PARENT') return 'Parent';
  if (t === 'PREQUEL') return 'Prequel';
  if (t === 'SEQUEL') return 'Sequel';
  if (t === 'SIDE_STORY') return 'Side Story';
  if (t === 'SPIN_OFF') return 'Spin-off';
  if (t === 'ALTERNATIVE') return 'Alternative';
  return 'Related';
}

function RelatedNode({ entry, emphasis }: NodeProps): React.ReactElement {
  const router = useRouter();
  const isBound = entry.toMangaId !== null && entry.targetMedium === 'MANGA';
  const external = externalLinkFor(entry.externalSource, entry.externalToId);
  const clickable = isBound || external !== null;
  const onClick = useCallback((): void => {
    if (isBound && entry.toMangaId !== null) {
      router.push(`/manga/${entry.toMangaId}`);
      return;
    }
    if (external) window.open(external, '_blank', 'noopener,noreferrer');
  }, [isBound, entry.toMangaId, external, router]);

  const borderColor =
    emphasis === 'branch' ? 'var(--mantine-color-gray-7)' : 'var(--mantine-color-blue-7)';

  return (
    <Stack gap={4} w={CARD_WIDTH} style={{ flex: '0 0 auto' }}>
      <Paper
        onClick={clickable ? onClick : undefined}
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
          backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${coverSrc(entry.toMangaCover)})`,
          border: `2px solid ${borderColor}`,
        }}
      >
        <Badge size="xs" color="blue" variant="filled" pos="absolute" top={6} left={6}>
          {relationLabel(entry.relationType)}
        </Badge>
        {!isBound && external && (
          <Box pos="absolute" bottom={6} right={6} c="white" style={{ opacity: 0.85 }}>
            <IconExternalLink size={12} />
          </Box>
        )}
      </Paper>
      <Text size="xs" c="gray.3" lineClamp={2} style={{ maxWidth: CARD_WIDTH, lineHeight: 1.2 }}>
        {entry.targetTitle}
      </Text>
    </Stack>
  );
}

function CurrentNode({ title, cover }: { title: string; cover: string | null }): React.ReactElement {
  return (
    <Stack gap={4} w={CARD_WIDTH} style={{ flex: '0 0 auto' }}>
      <Paper
        shadow="sm"
        radius="md"
        h={COVER_HEIGHT}
        w={CARD_WIDTH}
        pos="relative"
        style={{
          overflow: 'hidden',
          backgroundColor: '#2a2a2a',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.05)), url(${coverSrc(cover)})`,
          border: '3px solid var(--mantine-color-yellow-5)',
        }}
      >
        <Badge size="xs" color="yellow" variant="filled" pos="absolute" top={6} left={6}>
          You are here
        </Badge>
      </Paper>
      <Text size="xs" c="gray.1" fw={700} lineClamp={2} style={{ maxWidth: CARD_WIDTH, lineHeight: 1.2 }}>
        {title}
      </Text>
    </Stack>
  );
}

function ChainArrow(): React.ReactElement {
  return (
    <Box style={{ alignSelf: 'center', color: 'var(--mantine-color-gray-6)' }}>
      <IconArrowRight size={24} />
    </Box>
  );
}

export function ReadingOrderChain({
  mangaId,
  currentTitle,
  currentCover,
}: ReadingOrderChainProps): React.ReactNode {
  const { data: entries } = trpc.manga.getRelations.useQuery({ mangaId });

  const { before, after, branches } = useMemo(() => {
    const list = entries ?? [];
    const flow = list.filter((e) => READING_FLOW_TYPES.has(e.relationType));
    return {
      before: flow.filter((e) => TYPES_BEFORE.includes(e.relationType)),
      after: flow.filter((e) => TYPES_AFTER.includes(e.relationType)),
      branches: flow.filter((e) => TYPES_BRANCH.includes(e.relationType)),
    };
  }, [entries]);

  if (!entries || before.length + after.length + branches.length === 0) {
    return null;
  }

  return (
    <Box mb="lg" w="100%" maw="100%" style={{ minWidth: 0 }}>
      <Group mb="xs" gap="xs">
        <IconBookmark size={18} color="gold" />
        <Text size="sm" fw={600} c="gray.3">
          Reading Order
        </Text>
      </Group>

      <Group gap="sm" wrap="nowrap" align="flex-start" style={{ overflowX: 'auto', maxWidth: '100%' }}>
        {before.map((e) => (
          <Group key={e.id} gap="sm" wrap="nowrap" align="flex-start">
            <RelatedNode entry={e} emphasis="before" />
            <ChainArrow />
          </Group>
        ))}
        <CurrentNode title={currentTitle} cover={currentCover} />
        {after.map((e) => (
          <Group key={e.id} gap="sm" wrap="nowrap" align="flex-start">
            <ChainArrow />
            <RelatedNode entry={e} emphasis="after" />
          </Group>
        ))}
      </Group>

      {branches.length > 0 && (
        <Box mt="md">
          <Text size="xs" c="dimmed" mb="xs">
            Side stories &amp; spin-offs
          </Text>
          <Group gap="sm" wrap="nowrap" align="flex-start" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {branches.map((e) => (
              <RelatedNode key={e.id} entry={e} emphasis="branch" />
            ))}
          </Group>
        </Box>
      )}
    </Box>
  );
}
