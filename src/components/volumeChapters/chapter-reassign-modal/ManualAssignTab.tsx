/**
 * Manual Assign Tab Component
 *
 * Manual chapter-to-volume assignment with bulk selection.
 * Allows users to assert file type (chapter vs volume).
 *
 * @module components/volumeChapters/chapter-reassign-modal/ManualAssignTab
 */

import { memo, useState, useMemo, useCallback, type JSX } from 'react';

import { Stack, Group, Button, Paper, Select, ScrollArea, Badge, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import { ChapterRow } from './ChapterRow';

import type { ManualAssignTabProps, VolumeOption, ChapterOption, ChapterAssignment, FileType } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

function buildVolumeOptions(
  volumes: Array<{ number: number; title: string | null }> | undefined
): VolumeOption[] {
  const options: VolumeOption[] = [{ value: 'unassigned', label: 'Unassigned' }];
  if (volumes) {
    for (const v of volumes) {
      const label = v.title ? `Vol.${v.number}: ${v.title}` : `Volume ${v.number}`;
      options.push({ value: String(v.number), label });
    }
  }
  return options;
}

/** Build chapter options from assigned chapters (those with a volume assigned) */
function buildChapterOptions(
  chapters: Array<{ id: number; chapterNumber: number | null; index: number; title: string }> | undefined,
  unassignedIds: Set<number>
): ChapterOption[] {
  const options: ChapterOption[] = [];
  if (chapters) {
    // Filter to only assigned chapters (not in unassigned list)
    const assignedChapters = chapters.filter(ch => !unassignedIds.has(ch.id));
    for (const ch of assignedChapters) {
      const chNum = ch.chapterNumber ?? ch.index;
      const label = ch.title ? `Ch.${chNum}: ${ch.title}` : `Chapter ${chNum}`;
      options.push({ value: String(ch.id), label });
    }
  }
  return options;
}

function buildChapterAssignments(
  chapterLinks: Map<number, number>,
  volumeAssertions: Map<number, number>
): ChapterAssignment[] {
  const result: ChapterAssignment[] = [];
  // Chapter mode: link file to existing chapter
  chapterLinks.forEach((targetChapterId, chapterId) => {
    result.push({ chapterId, volumeNumber: null, fileType: 'chapter', targetChapterId });
  });
  // Volume mode: convert file to volume
  volumeAssertions.forEach((assertedVolumeNumber, chapterId) => {
    result.push({ chapterId, volumeNumber: null, fileType: 'volume', assertedVolumeNumber });
  });
  return result;
}

// ============================================================================
// Subcomponents
// ============================================================================

interface BulkAssignBarProps {
  selectedCount: number;
  volumeOptions: VolumeOption[];
  bulkVolume: string | null;
  onBulkVolumeChange: (value: string | null) => void;
  onApply: () => void;
  onClear: () => void;
}

function BulkAssignBar(props: BulkAssignBarProps): JSX.Element {
  const { selectedCount, volumeOptions, bulkVolume, onBulkVolumeChange, onApply, onClear } = props;
  return (
    <Paper p="sm" withBorder bg="blue.9">
      <Group justify="space-between">
        <Text size="sm">{selectedCount} selected</Text>
        <Group gap="xs">
          <Select
            size="xs"
            placeholder="Assign to volume..."
            data={volumeOptions}
            value={bulkVolume}
            onChange={onBulkVolumeChange}
            w={180}
          />
          <Button size="xs" onClick={onApply} disabled={!bulkVolume}>Apply</Button>
          <Button size="xs" variant="subtle" onClick={onClear}>Clear</Button>
        </Group>
      </Group>
    </Paper>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

function useManualAssignState(chapterIds: number[]): {
  selectedIds: Set<number>;
  chapterLinks: Map<number, number>;
  fileTypes: Map<number, FileType>;
  volumeAssertions: Map<number, number>;
  bulkVolume: string | null;
  setBulkVolume: (v: string | null) => void;
  toggleSelect: (id: number) => void;
  selectAll: () => void;
  selectNone: () => void;
  handleChapterLinkChange: (chapterId: number, value: string | null) => void;
  handleFileTypeChange: (chapterId: number, fileType: FileType) => void;
  handleAssertedVolumeNumberChange: (chapterId: number, volumeNumber: number | null | undefined) => void;
  applyBulkAssignment: () => void;
} {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkVolume, setBulkVolume] = useState<string | null>(null);
  const [chapterLinks, setChapterLinks] = useState<Map<number, number>>(new Map());
  const [fileTypes, setFileTypes] = useState<Map<number, FileType>>(new Map());
  const [volumeAssertions, setVolumeAssertions] = useState<Map<number, number>>(new Map());

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(chapterIds)), [chapterIds]);
  const selectNone = useCallback(() => setSelectedIds(new Set()), []);

  const handleChapterLinkChange = useCallback((chapterId: number, value: string | null) => {
    setChapterLinks(p => {
      const n = new Map(p);
      value === null ? n.delete(chapterId) : n.set(chapterId, parseInt(value, 10));
      return n;
    });
  }, []);

  const handleFileTypeChange = useCallback((chapterId: number, ft: FileType) => {
    if (ft === 'chapter') {
      setFileTypes(p => { const n = new Map(p); n.delete(chapterId); return n; });
      setVolumeAssertions(p => { const n = new Map(p); n.delete(chapterId); return n; });
    } else {
      setFileTypes(p => new Map(p).set(chapterId, ft));
      setChapterLinks(p => { const n = new Map(p); n.delete(chapterId); return n; });
    }
  }, []);

  const handleAssertedVolumeNumberChange = useCallback((chapterId: number, vn: number | null | undefined) => {
    setVolumeAssertions(p => {
      const n = new Map(p);
      // eslint-disable-next-line eqeqeq -- Using == null to check both null and undefined is idiomatic
      vn == null ? n.delete(chapterId) : n.set(chapterId, vn);
      return n;
    });
  }, []);

  const applyBulkAssignment = useCallback(() => {
    // Bulk assignment not supported for chapter links - only for volume assignment
    setBulkVolume(null);
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds, chapterLinks, fileTypes, volumeAssertions, bulkVolume, setBulkVolume,
    toggleSelect, selectAll, selectNone, handleChapterLinkChange, handleFileTypeChange,
    handleAssertedVolumeNumberChange, applyBulkAssignment
  };
}

// ============================================================================
// Main Component
// ============================================================================

function ManualAssignTabComponent(props: ManualAssignTabProps): JSX.Element {
  const { mangaId, unassignedChapters, onSave, isSaving } = props;
  const chapterIds = useMemo(() => unassignedChapters.map(c => c.id), [unassignedChapters]);
  const unassignedIdSet = useMemo(() => new Set(chapterIds), [chapterIds]);
  const state = useManualAssignState(chapterIds);

  const { data: volumes } = trpc.volume.list.useQuery({ mangaId }, { enabled: mangaId > 0 });
  const { data: allChapters } = trpc.chapter.getByMangaId.useQuery({ mangaId }, { enabled: mangaId > 0 });
  const volumeOptions = useMemo(() => buildVolumeOptions(volumes), [volumes]);
  const chapterOptions = useMemo(() => buildChapterOptions(allChapters, unassignedIdSet), [allChapters, unassignedIdSet]);

  const chapterCount = state.chapterLinks.size;
  const volumeCount = state.volumeAssertions.size;
  const totalChanges = chapterCount + volumeCount;

  const handleSave = useCallback(() => {
    const toSave = buildChapterAssignments(state.chapterLinks, state.volumeAssertions);
    if (toSave.length > 0) onSave(toSave);
  }, [state.chapterLinks, state.volumeAssertions, onSave]);

  return (
    <Stack gap="md">
      {state.selectedIds.size > 0 && (
        <BulkAssignBar
          selectedCount={state.selectedIds.size}
          volumeOptions={volumeOptions}
          bulkVolume={state.bulkVolume}
          onBulkVolumeChange={state.setBulkVolume}
          onApply={state.applyBulkAssignment}
          onClear={state.selectNone}
        />
      )}

      <Group justify="space-between">
        <Group gap="xs">
          <Button size="xs" variant="subtle" onClick={state.selectAll}>Select All</Button>
          <Button size="xs" variant="subtle" onClick={state.selectNone}>Select None</Button>
        </Group>
        <Group gap="xs">
          {chapterCount > 0 && <Badge color="green" size="sm">{chapterCount} chapter</Badge>}
          {volumeCount > 0 && <Badge color="blue" size="sm">{volumeCount} volume</Badge>}
        </Group>
      </Group>

      <ScrollArea h={300}>
        <Stack gap="xs">
          {unassignedChapters.map(ch => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              isSelected={state.selectedIds.has(ch.id)}
              linkedChapterId={state.chapterLinks.get(ch.id)}
              fileType={state.fileTypes.get(ch.id) ?? 'chapter'}
              assertedVolumeNumber={state.volumeAssertions.get(ch.id)}
              chapterOptions={chapterOptions}
              volumeOptions={volumeOptions}
              onToggleSelect={state.toggleSelect}
              onChapterLinkChange={state.handleChapterLinkChange}
              onFileTypeChange={state.handleFileTypeChange}
              onAssertedVolumeNumberChange={state.handleAssertedVolumeNumberChange}
            />
          ))}
        </Stack>
      </ScrollArea>

      <Group justify="flex-end">
        <Button
          leftSection={<IconCheck size={16} />}
          onClick={handleSave}
          loading={isSaving}
          disabled={totalChanges === 0}
        >
          Reassign {totalChanges > 1 ? 'Files' : 'File'} ({totalChanges})
        </Button>
      </Group>
    </Stack>
  );
}

export const ManualAssignTab = memo(ManualAssignTabComponent);
ManualAssignTab.displayName = 'ManualAssignTab';
