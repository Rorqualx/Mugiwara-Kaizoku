/**
 * Sort helpers for DetectMatchStage: comparator + clickable column header.
 *
 * @module components/library/import-pipeline/stages/DetectMatchStage/sort
 */
import { type JSX } from 'react';

import { Group, Table, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import type { MatchedMangaItem } from '@/components/library/import-pipeline/types';

export type SortCol = 'match' | 'source' | 'confidence' | 'status';
export type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<string, number> = {
  matched: 0,
  manual: 1,
  low_confidence: 2,
  no_match: 3,
  pending: 4,
  matching: 5,
  unmatched: 6,
  skipped: 7,
  error: 8,
};

function matchKey(i: MatchedMangaItem): string {
  return (i.selectedMatch?.title ?? i.parsedTitle).toLocaleLowerCase();
}

function statusKey(i: MatchedMangaItem): number {
  return STATUS_ORDER[i.status] ?? 99;
}

function compareItems(a: MatchedMangaItem, b: MatchedMangaItem, col: SortCol): number {
  switch (col) {
    case 'match': return matchKey(a).localeCompare(matchKey(b));
    case 'source': return a.path.toLocaleLowerCase().localeCompare(b.path.toLocaleLowerCase());
    case 'confidence': return a.confidence - b.confidence;
    case 'status': return statusKey(a) - statusKey(b);
    default: return 0;
  }
}

export function sortItems(items: MatchedMangaItem[], col: SortCol, dir: SortDir): MatchedMangaItem[] {
  const out = [...items];
  out.sort((a, b) => compareItems(a, b, col));
  if (dir === 'desc') out.reverse();
  return out;
}

interface SortableThProps {
  label: string;
  col: SortCol;
  sortBy: { col: SortCol; dir: SortDir } | null;
  onCycle: (col: SortCol) => void;
}

export function SortableTh({ label, col, sortBy, onCycle }: SortableThProps): JSX.Element {
  const active = sortBy?.col === col;
  const dir = active ? sortBy.dir : undefined;
  const Icon = !active ? IconArrowsSort : dir === 'asc' ? IconChevronUp : IconChevronDown;
  return (
    <Table.Th>
      <UnstyledButton onClick={() => onCycle(col)} aria-label={`Sort by ${label}`}>
        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={500}>{label}</Text>
          <Icon size={14} color={active ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-dimmed)'} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}
