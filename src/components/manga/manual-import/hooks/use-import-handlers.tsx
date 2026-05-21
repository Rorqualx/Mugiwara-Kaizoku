/**
 * useImportHandlers Hook
 *
 * Handles bulk assignment and import operations for the ManualImportModal.
 *
 * @module components/manga/manual-import/hooks/use-import-handlers
 */

import React from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import type { Chapter, ScannedFile, ChapterFileMapping } from '../types';

interface BulkAssignRangeParams {
  chapters: Chapter[];
  chapterFileMapping: ChapterFileMapping;
  bulkSelectedFile: string | null;
  bulkFromChapter: number | null;
  bulkToChapter: number | null;
  setChapterFileMapping: React.Dispatch<React.SetStateAction<ChapterFileMapping>>;
}

interface BulkAssignSelectedParams {
  chapterFileMapping: ChapterFileMapping;
  bulkSelectedFile: string | null;
  selectedChapters: Set<number>;
  setChapterFileMapping: React.Dispatch<React.SetStateAction<ChapterFileMapping>>;
  setSelectedChapters: React.Dispatch<React.SetStateAction<Set<number>>>;
}

interface ImportParams {
  chapters: Chapter[];
  scannedFiles: ScannedFile[];
  chapterFileMapping: ChapterFileMapping;
  selectedChapters: Set<number>;
  jobId: string;
  mangaId: number;
  mutate: (data: {
    jobId: string;
    mangaId: number;
    files: Array<{
      chapterId: number;
      sourcePath: string;
      fileName: string;
      chapterNumber?: number | undefined;
    }>;
  }) => void;
  setImporting: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Handle bulk assignment to a range of chapters
 */
export function handleBulkAssignRange(params: BulkAssignRangeParams): void {
  const {
    chapters,
    chapterFileMapping,
    bulkSelectedFile,
    bulkFromChapter,
    bulkToChapter,
    setChapterFileMapping
  } = params;

  if (!bulkSelectedFile) {
    showNotification({
      title: 'No File Selected',
      message: 'Please select a file for bulk assignment',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  if (bulkFromChapter === null || bulkToChapter === null) {
    showNotification({
      title: 'Invalid Range',
      message: 'Please select both From and To chapters',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  const fromChapter = chapters.find(ch => ch.id === bulkFromChapter);
  const toChapter = chapters.find(ch => ch.id === bulkToChapter);

  if (!fromChapter || !toChapter) {
    showNotification({
      title: 'Invalid Chapters',
      message: 'Selected chapters not found',
      color: 'red',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  const fromIndex = chapters.indexOf(fromChapter);
  const toIndex = chapters.indexOf(toChapter);

  if (fromIndex > toIndex) {
    showNotification({
      title: 'Invalid Range',
      message: '"From" chapter must come before "To" chapter',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  const newMapping = { ...chapterFileMapping };
  let assignCount = 0;

  for (let i = fromIndex; i <= toIndex; i++) {
    const chapter = chapters[i];
    if (chapter) {
      newMapping[chapter.id] = bulkSelectedFile;
      assignCount++;
    }
  }

  setChapterFileMapping(newMapping);

  showNotification({
    title: 'Bulk Assignment Complete',
    message: `Assigned file to ${assignCount} chapters`,
    color: 'green',
    icon: <IconCheck size={16} />
  });
}

/**
 * Handle bulk assignment to selected chapters
 */
export function handleBulkAssignToSelected(params: BulkAssignSelectedParams): void {
  const {
    chapterFileMapping,
    bulkSelectedFile,
    selectedChapters,
    setChapterFileMapping,
    setSelectedChapters
  } = params;

  if (!bulkSelectedFile) {
    showNotification({
      title: 'No File Selected',
      message: 'Please select a file for bulk assignment',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  if (selectedChapters.size === 0) {
    showNotification({
      title: 'No Chapters Selected',
      message: 'Please select chapters using checkboxes',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  const newMapping = { ...chapterFileMapping };
  for (const chapterId of selectedChapters) {
    newMapping[chapterId] = bulkSelectedFile;
  }
  setChapterFileMapping(newMapping);

  showNotification({
    title: 'Bulk Assignment Complete',
    message: `Assigned file to ${selectedChapters.size} selected chapters`,
    color: 'green',
    icon: <IconCheck size={16} />
  });

  setSelectedChapters(new Set());
}

/**
 * Handle import operation
 */
export function handleImportFiles(params: ImportParams): void {
  const {
    chapters,
    scannedFiles,
    chapterFileMapping,
    selectedChapters,
    jobId,
    mangaId,
    mutate,
    setImporting
  } = params;

  const chaptersToImport = selectedChapters.size > 0
    ? Array.from(selectedChapters)
    : Object.keys(chapterFileMapping).map(Number);

  const files = chaptersToImport
    .filter(chapterId => chapterFileMapping[chapterId])
    .map(chapterId => {
      const filePath = chapterFileMapping[chapterId];
      const chapter = chapters.find(ch => ch.id === chapterId);
      const file = scannedFiles.find(f => f.path === filePath);

      return {
        chapterId,
        sourcePath: filePath ?? '',
        fileName: file?.name ?? '',
        chapterNumber: chapter?.chapterNumber
      };
    });

  if (files.length === 0) {
    showNotification({
      title: selectedChapters.size > 0 ? 'No Files to Import' : 'No Assignments',
      message: selectedChapters.size > 0
        ? 'Selected chapters do not have file assignments'
        : 'Please assign files to at least one chapter',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    });
    return;
  }

  setImporting(true);
  void mutate({
    jobId,
    mangaId,
    files
  });
}
