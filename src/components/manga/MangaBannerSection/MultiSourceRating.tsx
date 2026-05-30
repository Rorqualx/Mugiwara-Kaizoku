/**
 * Phase 4 v2-D: multi-source rating display.
 *
 * Reads Metadata.rating (JSON shape from Phase 1) + Metadata.fieldAlternatives
 * (Phase 1.5 cutover) to render the winner rating plus dissenter rows in
 * a tooltip. When alternatives is empty (pre-cutover row), shows only the
 * winner.
 */

import React from 'react';

import { Badge, Stack, Text, Tooltip } from '@mantine/core';
import { IconStar } from '@tabler/icons-react';

import { parseFieldAlternatives } from '@/types/domain/field-alternatives-types';
import { parseRatingJson, type RatingJson } from '@/types/domain/rating-types';

import type { MangaWithRelations } from './types';

interface MultiSourceRatingProps {
  manga: MangaWithRelations;
}

interface RatingRow {
  source: string;
  value: number;
  scoredBy?: number | undefined;
  rank?: number | undefined;
}

export function MultiSourceRating({ manga }: MultiSourceRatingProps): React.ReactElement | null {
  const winner = parseRatingJson(manga.Metadata?.rating);
  if (!winner) {
    if (typeof manga.Metadata?.averageScore !== 'number') return null;
    // Pre-Phase-1 row: fall back to the AL scalar.
    return <SingleScoreBadge value={manga.Metadata.averageScore} />;
  }

  const alternatives = buildAlternativeRows(manga.Metadata?.fieldAlternatives);
  const tooltip = renderTooltip(winner, alternatives);

  return (
    <Tooltip label={tooltip} multiline w={280} withArrow position="bottom">
      <Badge color="yellow" size="lg" variant="filled" leftSection={<IconStar size={14} />}>
        {(winner.value / 10).toFixed(1)}/10
        {alternatives.length > 0 && ` +${alternatives.length}`}
      </Badge>
    </Tooltip>
  );
}

function SingleScoreBadge({ value }: { value: number }): React.ReactElement {
  return (
    <Badge color="yellow" size="lg" variant="filled" leftSection={<IconStar size={14} />}>
      {(value / 10).toFixed(1)}/10
    </Badge>
  );
}

function buildAlternativeRows(fieldAlternatives: unknown): RatingRow[] {
  const parsed = parseFieldAlternatives(fieldAlternatives);
  if (!parsed) return [];
  const ratingAlts = parsed['rating'];
  if (!ratingAlts || ratingAlts.length === 0) return [];
  const rows: RatingRow[] = [];
  for (const alt of ratingAlts) {
    const r = parseRatingJson(alt.value);
    if (!r) continue;
    rows.push({
      source: alt.provider,
      value: r.value,
      scoredBy: r.scoredBy,
      rank: r.rank,
    });
  }
  return rows;
}

function renderTooltip(winner: RatingJson, alternatives: RatingRow[]): React.ReactNode {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600} c="yellow.4">
        Rating breakdown
      </Text>
      <RatingRowDisplay
        source={winner.source ?? 'primary'}
        value={winner.value}
        scoredBy={winner.scoredBy}
        rank={winner.rank}
        isWinner
      />
      {alternatives.map((alt, idx) => (
        <RatingRowDisplay
          key={`${alt.source}-${idx}`}
          source={alt.source}
          value={alt.value}
          scoredBy={alt.scoredBy}
          rank={alt.rank}
        />
      ))}
    </Stack>
  );
}

function RatingRowDisplay({
  source,
  value,
  scoredBy,
  rank,
  isWinner = false,
}: {
  source: string;
  value: number;
  scoredBy?: number | undefined;
  rank?: number | undefined;
  isWinner?: boolean;
}): React.ReactElement {
  const parts: string[] = [`${(value / 10).toFixed(1)}/10`];
  if (typeof scoredBy === 'number' && scoredBy > 0) {
    parts.push(`${formatVotes(scoredBy)} votes`);
  }
  if (typeof rank === 'number') {
    parts.push(`#${rank}`);
  }
  return (
    <Text size="xs" c={isWinner ? 'gray.1' : 'gray.4'}>
      <strong>{source}</strong>: {parts.join(' · ')}
      {isWinner ? ' (primary)' : ''}
    </Text>
  );
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
