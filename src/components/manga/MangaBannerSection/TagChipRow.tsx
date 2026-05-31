/**
 * Phase 4 v2-A: always-visible chip row for `Metadata.themes` + `Metadata.tags`.
 *
 * Themes render first (curated, fewer) in orange; tags follow in violet with
 * a deep-link to `/browse/tag/<tag>`. Collapses to `INITIAL_VISIBLE` chips
 * with an inline "+N more" toggle to keep the banner compact for titles with
 * 100+ tags (Berserk has 284).
 */

'use client';

import React, { useMemo, useState } from 'react';

import { Badge, Box, Group, UnstyledButton } from '@mantine/core';

import type { MangaWithRelations } from './types';

const INITIAL_VISIBLE = 8;

interface TagChipRowProps {
  manga: MangaWithRelations;
}

interface ChipItem {
  key: string;
  label: string;
  color: string;
  href: string | null;
}

function toStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function buildChips(themes: string[], tags: string[]): ChipItem[] {
  const items: ChipItem[] = [];
  themes.forEach((t) => items.push({ key: `theme:${t}`, label: t, color: 'orange', href: null }));
  tags.forEach((t) =>
    items.push({
      key: `tag:${t}`,
      label: t,
      color: 'violet',
      href: `/browse/tag/${encodeURIComponent(t)}`,
    }),
  );
  return items;
}

function renderChip(item: ChipItem): React.ReactElement {
  const badge = (
    <Badge size="sm" variant="light" color={item.color} style={{ cursor: item.href ? 'pointer' : 'default' }}>
      {item.label}
    </Badge>
  );
  if (item.href === null) {
    return <React.Fragment key={item.key}>{badge}</React.Fragment>;
  }
  return (
    <a key={item.key} href={item.href} style={{ textDecoration: 'none' }}>
      {badge}
    </a>
  );
}

export function TagChipRow({ manga }: TagChipRowProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const themes = useMemo(() => toStrings(manga.Metadata?.themes), [manga.Metadata?.themes]);
  const tags = useMemo(() => toStrings(manga.Metadata?.tags), [manga.Metadata?.tags]);
  const chips = useMemo(() => buildChips(themes, tags), [themes, tags]);

  if (chips.length === 0) return null;

  const visible = expanded ? chips : chips.slice(0, INITIAL_VISIBLE);
  const overflow = chips.length - INITIAL_VISIBLE;

  return (
    <Box mb="lg">
      <Group gap="xs">
        {visible.map(renderChip)}
        {overflow > 0 && (
          <UnstyledButton onClick={() => setExpanded((v) => !v)}>
            <Badge size="sm" variant="filled" color="gray" style={{ cursor: 'pointer' }}>
              {expanded ? 'Show less' : `+${overflow} more`}
            </Badge>
          </UnstyledButton>
        )}
      </Group>
    </Box>
  );
}
