/**
 * Custom hook for managing VolumeChapterTable state and logic
 */

import { useState, useMemo, useCallback } from 'react';

import type { VolumeData, ChapterData } from '@/components/addManga/types';


interface UseVolumeChapterTableOptions {
  volumes: VolumeData[];
  chapters: ChapterData[];
  initialExpanded?: string[] | undefined;
  onVolumeSelect?: ((volume: VolumeData) => void) | undefined;
  onChapterSelect?: ((chapter: ChapterData) => void) | undefined;
}

interface UseVolumeChapterTableReturn {
  expandedVolumes: Set<string>;
  selectedVolumes: Set<string>;
  selectedChapters: Set<string>;
  chaptersByVolume: Map<number, ChapterData[]>;
  toggleVolume: (volumeId: string) => void;
  handleVolumeSelect: (volume: VolumeData, checked: boolean) => void;
  handleChapterSelect: (chapter: ChapterData, checked: boolean) => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;
  stats: {
    totalVolumes: number;
    totalChapters: number;
    selectedVolumes: number;
    selectedChapters: number;
  };
}

export function useVolumeChapterTable({
  volumes,
  chapters,
  initialExpanded = [],
  onVolumeSelect,
  onChapterSelect,
}: UseVolumeChapterTableOptions): UseVolumeChapterTableReturn {
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(
    new Set(initialExpanded)
  );
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());

  // Group chapters by volume
  const chaptersByVolume = useMemo(() => {
    const grouped = new Map<number, ChapterData[]>();

    chapters.forEach((chapter) => {
      const volumeNum = chapter.volumeNumber ?? 0;
      const existing = grouped.get(volumeNum);
      if (existing) {
        existing.push(chapter);
      } else {
        grouped.set(volumeNum, [chapter]);
      }
    });

    // Sort chapters within each volume
    grouped.forEach((chaps) => {
      chaps.sort((a, b) => a.chapterNumber - b.chapterNumber);
    });

    return grouped;
  }, [chapters]);

  // Toggle volume expansion
  const toggleVolume = useCallback((volumeId: string): void => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) {
        next.delete(volumeId);
      } else {
        next.add(volumeId);
      }
      return next;
    });
  }, []);

  // Handle volume selection
  const handleVolumeSelect = useCallback((volume: VolumeData, checked: boolean): void => {
    setSelectedVolumes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(volume.id);
      } else {
        next.delete(volume.id);
      }
      return next;
    });

    // Also select/deselect all chapters in this volume
    const volumeChapters = chaptersByVolume.get(volume.volumeNumber) ?? [];
    if (checked) {
      setSelectedChapters((current) => {
        const next = new Set(current);
        volumeChapters.forEach((chapter) => {
          next.add(chapter.id);
        });
        return next;
      });
    } else {
      setSelectedChapters((current) => {
        const next = new Set(current);
        volumeChapters.forEach((chapter) => {
          next.delete(chapter.id);
        });
        return next;
      });
    }

    if (onVolumeSelect) {
      onVolumeSelect(volume);
    }
  }, [chaptersByVolume, onVolumeSelect]);

  // Handle chapter selection
  const handleChapterSelect = useCallback((chapter: ChapterData, checked: boolean): void => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(chapter.id);
      } else {
        next.delete(chapter.id);
      }
      return next;
    });

    if (onChapterSelect) {
      onChapterSelect(chapter);
    }
  }, [onChapterSelect]);

  // Handle select all
  const handleSelectAll = useCallback((): void => {
    setSelectedVolumes(new Set(volumes.map((v) => v.id)));
    setSelectedChapters(new Set(chapters.map((c) => c.id)));
  }, [volumes, chapters]);

  // Handle clear selection
  const handleClearSelection = useCallback((): void => {
    setSelectedVolumes(new Set());
    setSelectedChapters(new Set());
  }, []);

  // Calculate statistics
  const stats = useMemo(() => ({
    totalVolumes: volumes.length,
    totalChapters: chapters.length,
    selectedVolumes: selectedVolumes.size,
    selectedChapters: selectedChapters.size,
  }), [volumes.length, chapters.length, selectedVolumes.size, selectedChapters.size]);

  return {
    expandedVolumes,
    selectedVolumes,
    selectedChapters,
    chaptersByVolume,
    toggleVolume,
    handleVolumeSelect,
    handleChapterSelect,
    handleSelectAll,
    handleClearSelection,
    stats,
  };
}
