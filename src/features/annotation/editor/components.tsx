/**
 * Annotation Editor Components
 *
 * Main barrel file that re-exports components from submodules.
 * Individual component implementations are in the ./components/ subdirectory.
 */

import React, { useState, useEffect, useRef } from 'react';

import {
  Accordion,
  Text,
  Button,
  Group,
  Card,
  Stack,
  Badge,
  Paper,
  Tooltip,
  Kbd,
  Transition,
} from '@mantine/core';

import type { EntityType } from '@/server/ml/features/bio-types';

import { ENTITY_COLORS } from './types';

import type { DisplayToken } from './types';

// Re-export components from submodules
export { TokenDisplay, TokenBadge, ImageToken } from './components/token-display';
export { SummaryTable } from './components/summary-table';
export { SelectionsSummary } from './components/selections-summary';
export { SelectionToolbar } from './components/SelectionToolbar';
export { TokenDetailModal } from './components/TokenDetailModal';

// ============================================================================
// Label Palette - Organized into logical groups
// ============================================================================

interface LabelCategory {
  id: string;
  title: string;
  description: string;
  labels: EntityType[];
  defaultOpen: boolean;
  badge?: { text: string; color: string };
}

const LABEL_CATEGORIES: LabelCategory[] = [
  {
    id: 'core',
    title: 'Series Metadata',
    description: 'Series-level info - label each field once',
    labels: ['TITLE', 'ALT_TITLE', 'AUTHOR', 'ARTIST', 'SERIES_SUMMARY', 'STATUS', 'GENRE', 'DEMOGRAPHIC', 'PUBLISHER', 'ENGLISH_PUBLISHER', 'MAGAZINE', 'RELEASE_DATE', 'START_DATE', 'END_DATE', 'COVER_IMAGE', 'THEMES', 'TAGS', 'FORMAT', 'VOLUME_COUNT', 'CHAPTER_COUNT', 'GALLERY_URL'],
    defaultOpen: true,
  },
  {
    id: 'sections',
    title: 'Data Sections',
    description: 'Mark table/list areas - label the container',
    labels: ['VOLUME_TABLE', 'CHAPTER_TABLE', 'GALLERY_SECTION'],
    defaultOpen: true,
    badge: { text: 'SECTION', color: 'indigo' },
  },
  {
    id: 'volume-items',
    title: 'Volume Items',
    description: 'Label 2-3 examples only',
    labels: ['VOLUME_TITLE', 'VOLUME_ALT_TITLE', 'VOLUME_COVER', 'VOLUME_SUMMARY', 'VOLUME_RELEASE_DATE', 'ISBN', 'ENGLISH_RELEASE_DATE', 'ENGLISH_ISBN', 'ENGLISH_PUBLISHER', 'VOLUME_NUMBER', 'VOLUME_PAGE_COUNT', 'VOLUME_URL', 'CHAPTER_RANGE', 'CHAPTER_COUNT'],
    defaultOpen: true,
    badge: { text: '2-3 ONLY', color: 'yellow' },
  },
  {
    id: 'chapter-items',
    title: 'Chapter Items',
    description: 'Label 2-3 examples only',
    labels: ['CHAPTER_TITLE', 'CHAPTER_ALT_TITLE', 'CHAPTER_URL', 'CHAPTER_COVER', 'CHAPTER_SUMMARY', 'CHAPTER_RELEASE_DATE', 'CHAPTER_NUMBER', 'CHAPTER_BELONGS_TO_VOLUME', 'PAGE_COUNT'],
    defaultOpen: true,
    badge: { text: '2-3 ONLY', color: 'yellow' },
  },
];

const ENTITY_TOOLTIPS: Record<EntityType, string> = {
  // Core metadata (alphabetical)
  ALT_TITLE: 'Alternative/English/Japanese titles',
  ARTIST: 'Illustrator/artist name',
  AUTHOR: 'Writer/story creator name',
  COVER_IMAGE: 'Main cover image',
  DEMOGRAPHIC: 'Shounen, Seinen, Shoujo, etc.',
  FORMAT: 'Manga, Manhwa, Light Novel, etc.',
  GENRE: 'Action, Romance, Fantasy, etc.',
  MAGAZINE: 'Magazine where serialized',
  ORIGINAL_RUN: 'Original run date range (start – end dates)',
  START_DATE: 'Serialization start date (e.g., April 13, 2005)',
  END_DATE: 'Serialization end date (e.g., July 25, 2025) or "present"',
  PAGE_TYPE: 'Page classification (MANGA_PAGE, VOLUMES, CHAPTERS, etc.)',
  PUBLISHER: 'Japanese publishing company name',
  RELEASE_DATE: 'Start date or publication date',
  SERIES_SUMMARY: 'Series description or synopsis (not chapter pages)',
  STATUS: 'Ongoing, Completed, Hiatus, etc.',
  TAGS: 'Content tags (e.g., Isekai, Harem)',
  THEMES: 'Story themes (e.g., Revenge, Coming of Age)',
  TITLE: 'Main manga title',
  // Counts
  CHAPTER_COUNT: 'Total number of chapters',
  CHAPTER_RANGE: 'Range of chapters in a volume (e.g., "12 - 15")',
  PAGE_COUNT: 'Number of pages in a chapter',
  VOLUME_COUNT: 'Total number of volumes',
  VOLUME_NUMBER: 'This volume\'s sequence number (e.g., Vol. 4)',
  VOLUME_PAGE_COUNT: 'Number of pages in a volume',
  // Chapter-specific
  CHAPTER_ALT_TITLE: 'Japanese/alternative title for chapter (in parentheses after title)',
  CHAPTER_BELONGS_TO_VOLUME: 'Which volume this chapter belongs to (on chapter pages)',
  CHAPTER_COVER: 'Chapter cover image (2-3 examples)',
  CHAPTER_NUMBER: 'The chapter number (on chapter pages, e.g., "Chapter 1")',
  CHAPTER_RELEASE_DATE: 'Chapter release date (2-3 examples)',
  CHAPTER_SUMMARY: 'Chapter description (2-3 examples)',
  CHAPTER_TITLE: 'Chapter name (2-3 examples)',
  CHAPTER_URL: 'URL to individual chapter page',
  // Volume-specific
  ENGLISH_ISBN: 'English edition ISBN (ISBN-10 or ISBN-13)',
  ENGLISH_PUBLISHER: 'English edition publisher (e.g., Kodansha USA, Viz Media)',
  ENGLISH_RELEASE_DATE: 'English edition release date',
  ISBN: 'Book identifier (ISBN-10 or ISBN-13)',
  VOLUME_ALT_TITLE: 'Alternative/Japanese volume title',
  VOLUME_COVER: 'Volume cover image (2-3 examples)',
  VOLUME_RELEASE_DATE: 'Volume release date (2-3 examples)',
  VOLUME_SUMMARY: 'Volume description (2-3 examples)',
  VOLUME_TITLE: 'Individual volume name (2-3 examples)',
  VOLUME_URL: 'Link to individual volume page',
  // Navigation/Links
  CHAPTERS_LIST_URL: 'Link to separate chapters page (deprecated)',
  GALLERY_URL: 'Link to gallery page',
  VOLUMES_LIST_URL: 'Link to separate volumes page (deprecated)',
  // Table/Data sections
  CHAPTER_TABLE: 'The entire chapters table/list section',
  GALLERY_SECTION: 'Image gallery area',
  VOLUME_CHAPTER_TABLE: 'Combined volume and chapter table/list section',
  VOLUME_TABLE: 'The entire volumes table/list section',
};

interface LabelPaletteProps {
  onApply: (entity: EntityType | null) => void;
  selectedCount: number;
  activeBrush?: string | null;
  onBrushSelect?: (entity: string | null) => void;
  onBrushClear?: () => void;
  bioPrefix: 'B' | 'I';
  onBioPrefixChange: (prefix: 'B' | 'I') => void;
}

export function LabelPalette(props: LabelPaletteProps): React.ReactElement {
  const { onApply, selectedCount, activeBrush, onBrushSelect, onBrushClear, bioPrefix, onBioPrefixChange } = props;
  const defaultOpenIds = LABEL_CATEGORIES.filter(c => c.defaultOpen).map(c => c.id);

  const handleClick = (entity: EntityType | null): void => {
    if (selectedCount > 0) {
      onApply(entity);
      return;
    }
    if (!onBrushSelect) return;
    const brushValue = entity ?? 'CLEAR';
    if (activeBrush === brushValue) {
      onBrushClear?.();
    } else {
      onBrushSelect(brushValue);
    }
  };

  return (
    <Card withBorder p="xs">
      <LabelPaletteHeader activeBrush={activeBrush} selectedCount={selectedCount} />

      {/* B/I Prefix Toggle */}
      <Group gap="xs" mb="sm">
        <Button
          size="compact-xs"
          variant={bioPrefix === 'B' ? 'filled' : 'light'}
          color="blue"
          onClick={() => onBioPrefixChange('B')}
          style={{ flex: 1 }}
        >
          B (Begin)
        </Button>
        <Button
          size="compact-xs"
          variant={bioPrefix === 'I' ? 'filled' : 'light'}
          color="cyan"
          onClick={() => onBioPrefixChange('I')}
          style={{ flex: 1 }}
        >
          I (Inside)
        </Button>
      </Group>

      <Accordion multiple defaultValue={defaultOpenIds} styles={{ content: { padding: 4 }, control: { padding: '4px 8px' } }}>
        {LABEL_CATEGORIES.map((category) => (
          <LabelCategorySection
            key={category.id}
            category={category}
            activeBrush={activeBrush}
            onLabelClick={handleClick}
          />
        ))}
      </Accordion>
      <ClearLabelButton activeBrush={activeBrush} onClick={() => handleClick(null)} />
    </Card>
  );
}

function LabelPaletteHeader({ activeBrush, selectedCount }: { activeBrush?: string | null | undefined; selectedCount: number }): React.ReactElement {
  const statusText = selectedCount > 0
    ? `${selectedCount} selected → click label`
    : activeBrush ? 'Click elements to label' : 'Click a label to start';

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={600}>Labels</Text>
        {activeBrush && (
          <Badge size="xs" color="green" variant="light">
            {activeBrush === 'CLEAR' ? 'Clear' : activeBrush.replace(/_/g, ' ')}
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed" mb="sm">{statusText}</Text>
    </>
  );
}

function LabelCategorySection({ category, activeBrush, onLabelClick }: {
  category: LabelCategory;
  activeBrush?: string | null | undefined;
  onLabelClick: (entity: EntityType) => void;
}): React.ReactElement {
  return (
    <Accordion.Item value={category.id}>
      <Accordion.Control>
        <Group gap="xs">
          <Text size="xs" fw={500}>{category.title}</Text>
          {category.badge && <Badge size="xs" color={category.badge.color} variant="outline">{category.badge.text}</Badge>}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Text size="xs" c="dimmed" mb={4}>{category.description}</Text>
        <Stack gap={4}>
          {category.labels.map((entity) => (
            <LabelButton key={entity} entity={entity} activeBrush={activeBrush} onClick={() => onLabelClick(entity)} />
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function LabelButton({ entity, activeBrush, onClick }: {
  entity: EntityType;
  activeBrush?: string | null | undefined;
  onClick: () => void;
}): React.ReactElement {
  const isActive = activeBrush === entity;
  const displayName = entity.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Tooltip label={ENTITY_TOOLTIPS[entity]} position="right" withArrow multiline w={200}>
      <Button
        size="compact-xs"
        variant={isActive ? 'filled' : 'light'}
        color={ENTITY_COLORS[entity]}
        onClick={onClick}
        justify="space-between"
        fullWidth
        rightSection={
          isActive ? <Badge size="xs" color="green" variant="filled">●</Badge> : null
        }
      >
        {displayName}
      </Button>
    </Tooltip>
  );
}

function ClearLabelButton({ activeBrush, onClick }: { activeBrush?: string | null | undefined; onClick: () => void }): React.ReactElement {
  return (
    <Button
      size="compact-xs"
      variant={activeBrush === 'CLEAR' ? 'filled' : 'subtle'}
      color="gray"
      onClick={onClick}
      fullWidth
      mt="xs"
      rightSection={activeBrush === 'CLEAR' ? <Badge size="xs" color="green" variant="filled">●</Badge> : null}
    >
      Clear Label (O)
    </Button>
  );
}

// ============================================================================
// Stats Panel
// ============================================================================

interface CountChange {
  entity: string;
  delta: number;
  timestamp: number;
}

function detectCountChanges(
  entityCounts: Record<string, number>,
  prevCounts: Record<string, number>
): CountChange[] {
  const changes: CountChange[] = [];
  const timestamp = Date.now();

  for (const [entity, count] of Object.entries(entityCounts)) {
    const prevCount = prevCounts[entity] ?? 0;
    if (count !== prevCount) {
      changes.push({ entity, delta: count - prevCount, timestamp });
    }
  }

  return changes;
}

function useCountChanges(entityCounts: Record<string, number>): CountChange[] {
  const prevCountsRef = useRef<Record<string, number>>({});
  const [recentChanges, setRecentChanges] = useState<CountChange[]>([]);

  useEffect(() => {
    const newChanges = detectCountChanges(entityCounts, prevCountsRef.current);

    if (newChanges.length > 0) {
      setRecentChanges(newChanges);
      const timer = setTimeout(() => setRecentChanges([]), 1500);
      prevCountsRef.current = { ...entityCounts };
      return () => clearTimeout(timer);
    }

    prevCountsRef.current = { ...entityCounts };
  }, [entityCounts]);

  return recentChanges;
}

export function StatsPanel({ tokens }: { tokens: DisplayToken[] }): React.ReactElement {
  const { entityCounts, labeledCount } = calculateStats(tokens);
  const recentChanges = useCountChanges(entityCounts);

  const getChange = (entity: string): CountChange | null =>
    recentChanges.find((c) => c.entity === entity) ?? null;

  return (
    <Card withBorder p="sm">
      <Text size="sm" fw={500} mb="xs">Statistics</Text>
      <Stack gap="xs">
        <StatSummaryRow label="Total tokens:" value={tokens.length} />
        <StatSummaryRow label="Labeled:" value={labeledCount} />
        {Object.entries(entityCounts).map(([entity, count]) => (
          <StatRow key={entity} entity={entity as EntityType} count={count} change={getChange(entity)} />
        ))}
      </Stack>
    </Card>
  );
}

function StatSummaryRow({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <Group justify="space-between">
      <Text size="xs">{label}</Text>
      <Text size="xs" fw={500}>{value}</Text>
    </Group>
  );
}

function StatRow({ entity, count, change }: { entity: EntityType; count: number; change: CountChange | null }): React.ReactElement {
  const hasChange = change !== null && change.delta !== 0;
  const isIncrease = change !== null && change.delta > 0;
  const color = hasChange ? (isIncrease ? 'green' : 'red') : 'dark';
  // Pre-compute delta display - use direct check so TypeScript can narrow change type
  const deltaDisplay = change && change.delta !== 0
    ? (change.delta > 0 ? `+${change.delta}` : String(change.delta))
    : '';

  return (
    <Group justify="space-between">
      <Badge size="xs" color={ENTITY_COLORS[entity]} variant="light">{entity}</Badge>
      <Group gap={4}>
        <Text size="xs" fw={hasChange ? 700 : 400} c={color}>{count}</Text>
        <Transition mounted={hasChange} transition="slide-left" duration={200}>
          {(styles) => (
            <Text size="xs" fw={700} c={isIncrease ? 'green' : 'red'} style={{ ...styles, minWidth: 20 }}>
              {deltaDisplay}
            </Text>
          )}
        </Transition>
      </Group>
    </Group>
  );
}

function calculateStats(tokens: DisplayToken[]): { entityCounts: Record<string, number>; labeledCount: number } {
  const entityCounts: Record<string, number> = {};
  let labeledCount = 0;

  for (const token of tokens) {
    if (token.label !== 'O') {
      labeledCount++;
      const entity = token.label.substring(2);
      entityCounts[entity] = (entityCounts[entity] ?? 0) + 1;
    }
  }

  return { entityCounts, labeledCount };
}

// ============================================================================
// Shortcuts Panel - Quick reference for labeling workflow
// ============================================================================

export function ShortcutsPanel(): React.ReactElement {
  return (
    <Paper withBorder p="sm" mt="md" bg="gray.0">
      <Group gap="xl" align="flex-start">
        <Stack gap={4}>
          <Text size="xs" fw={600}>B/I Labeling Workflow</Text>
          <Text size="xs" c="dimmed">1. Press <Kbd size="xs">B</Kbd> to start entity span</Text>
          <Text size="xs" c="dimmed">2. Click entity button (e.g., TITLE)</Text>
          <Text size="xs" c="dimmed">3. Auto-switches to I mode for continuation</Text>
          <Text size="xs" c="dimmed">4. Click more to add I-tagged tokens</Text>
        </Stack>
        <Stack gap={4}>
          <Text size="xs" fw={600}>Shortcuts</Text>
          <Group gap="md">
            <Group gap={2}><Kbd size="xs">B</Kbd><Text size="xs">Begin mode</Text></Group>
            <Group gap={2}><Kbd size="xs">I</Kbd><Text size="xs">Inside mode</Text></Group>
          </Group>
          <Group gap="md">
            <Group gap={2}><Kbd size="xs">O</Kbd><Text size="xs">Clear label</Text></Group>
            <Group gap={2}><Kbd size="xs">Esc</Kbd><Text size="xs">Exit/Deselect</Text></Group>
          </Group>
        </Stack>
        <Stack gap={4}>
          <Text size="xs" fw={600} c="yellow.7">Labeling Tips</Text>
          <Text size="xs" c="dimmed">• B = Begin (first token of entity)</Text>
          <Text size="xs" c="dimmed">• I = Inside (continuation tokens)</Text>
          <Text size="xs" c="dimmed">• Label 2-3 examples per entity type</Text>
        </Stack>
      </Group>
    </Paper>
  );
}

