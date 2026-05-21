/**
 * Hook for managing file matching logic
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { trpc } from '@/utils/trpc-client';

import { parseChapterFromFilename } from '../utils/filename-parsing';

import type { FileInfo, MatchStats } from '../types';

export function useFileMatching(
  itemPath: string | undefined,
  activeStep: number,
  opened: boolean
): {
  files: FileInfo[];
  editingFileIndex: number | null;
  matchStats: MatchStats;
  handleUpdateMatch: (index: number, chapter: number | undefined, volume: number | undefined) => void;
  setEditingFileIndex: (index: number | null) => void;
  directoryQuery: ReturnType<typeof trpc.files.listDirectory.useQuery>;
} {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  // Directory listing query
  const directoryQuery = trpc.files.listDirectory.useQuery(
    { dirPath: itemPath ?? '/', recursive: false, maxDepth: 1 },
    { enabled: !!itemPath && opened }
  );

  // Process directory contents and auto-match when entering step 1
  useEffect(() => {
    if (activeStep === 1 && directoryQuery.data?.files) {
      const fileList: FileInfo[] = directoryQuery.data.files
        .map((entry: { name: string; path: string; size?: number }) => {
          const parsed = parseChapterFromFilename(entry.name);
          const hasDetected = parsed.chapter !== undefined || parsed.volume !== undefined;
          return {
            name: entry.name,
            path: entry.path,
            size: entry.size ?? 0,
            detectedChapter: parsed.chapter,
            detectedVolume: parsed.volume,
            // Auto-match if we detected something
            matchedChapter: parsed.chapter,
            matchedVolume: parsed.volume,
            matchStatus: hasDetected ? 'auto' as const : 'unmatched' as const
          };
        })
        .sort((a: FileInfo, b: FileInfo) => {
          // Sort by volume first, then chapter, then name
          if (a.detectedVolume !== undefined && b.detectedVolume !== undefined) {
            return a.detectedVolume - b.detectedVolume;
          }
          if (a.detectedChapter !== undefined && b.detectedChapter !== undefined) {
            return a.detectedChapter - b.detectedChapter;
          }
          return a.name.localeCompare(b.name);
        });
      setFiles(fileList);
    }
  }, [activeStep, directoryQuery.data]);

  // Handle manual chapter/volume assignment
  const handleUpdateMatch = useCallback((index: number, chapter: number | undefined, volume: number | undefined) => {
    setFiles(prev => {
      const updated = [...prev];
      const currentFile = updated[index];
      if (!currentFile) return prev;
      updated[index] = {
        name: currentFile.name,
        path: currentFile.path,
        size: currentFile.size,
        detectedChapter: currentFile.detectedChapter,
        detectedVolume: currentFile.detectedVolume,
        matchedChapter: chapter,
        matchedVolume: volume,
        matchStatus: chapter !== undefined || volume !== undefined ? 'manual' : 'unmatched'
      };
      return updated;
    });
    setEditingFileIndex(null);
  }, []);

  // Matching stats
  const matchStats = useMemo(() => {
    const auto = files.filter(f => f.matchStatus === 'auto').length;
    const manual = files.filter(f => f.matchStatus === 'manual').length;
    const unmatched = files.filter(f => f.matchStatus === 'unmatched').length;
    return { auto, manual, unmatched, total: files.length, matched: auto + manual };
  }, [files]);

  return {
    files,
    editingFileIndex,
    matchStats,
    handleUpdateMatch,
    setEditingFileIndex,
    directoryQuery
  };
}
