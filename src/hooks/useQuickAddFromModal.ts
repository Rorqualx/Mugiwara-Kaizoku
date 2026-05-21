/**
 * Quick Add from Modal Hook
 *
 * Shared hook for adding manga to library from a MangaDetailModal.
 * Used by author, genre, and tag browse pages.
 */

import { useCallback, useState } from 'react';

import type { QuickAddProgress } from '@/components/addManga/services/quickAddService';
import type { MangaDetailData } from '@/components/home/MangaDetailModal';
import { trpc } from '@/utils/trpc-client';

interface QuickAddState {
  progressOpened: boolean;
  progressTitle: string | undefined;
  progressCover: string | undefined;
  progress: QuickAddProgress;
}

interface UseQuickAddReturn extends QuickAddState {
  handleAdd: (manga: MangaDetailData) => Promise<void>;
  closeProgress: () => void;
}

/** Build the add-mutation input from MangaDetailModal data */
function buildAddInput(manga: MangaDetailData, libraryId: number): {
  title: string; source: string; libraryId: number; mangaId: string;
  metadata: Record<string, unknown>;
} {
  const title = manga.title.english ?? manga.title.romaji ?? 'Unknown';
  return {
    title, source: 'anilist', libraryId, mangaId: String(manga.id),
    metadata: {
      cover: manga.coverImage.large ?? manga.coverImage.medium,
      coverLarge: manga.coverImage.extraLarge ?? manga.coverImage.large,
      description: manga.description, status: manga.status,
      genres: manga.genres, synonyms: manga.synonyms,
      averageScore: manga.averageScore, popularity: manga.popularity,
      sourceId: String(manga.id),
    },
  };
}

export function useQuickAddFromModal(onSuccess?: () => void): UseQuickAddReturn {
  const [state, setState] = useState<QuickAddState>({
    progressOpened: false,
    progressTitle: undefined,
    progressCover: undefined,
    progress: { stage: 'importing', message: 'Starting...', progress: 0 },
  });

  const librariesQuery = trpc.library.list.useQuery();
  const addMutation = trpc.manga.add.useMutation();
  const enrichMutation = trpc.manga.oneClickEnrich.useMutation();

  const handleAdd = useCallback(async (manga: MangaDetailData) => {
    const defaultLib = librariesQuery.data?.[0];
    if (!defaultLib) return;
    const title = manga.title.english ?? manga.title.romaji ?? 'Unknown';
    const cover = manga.coverImage.large ?? manga.coverImage.medium ?? undefined;

    setState({ progressOpened: true, progressTitle: title, progressCover: cover,
      progress: { stage: 'importing', message: 'Adding to library...', progress: 30 } });

    try {
      const input = buildAddInput(manga, defaultLib.id);
      const result = await addMutation.mutateAsync(input);
      setState(s => ({ ...s, progress: { stage: 'fetching_metadata', message: 'Enriching...', progress: 70 } }));
      await enrichMutation.mutateAsync({ mangaId: result.id, title }).catch(() => {/* non-fatal */});
      setState(s => ({ ...s, progress: { stage: 'complete', message: 'Complete!', progress: 100 } }));
      onSuccess?.();
    } catch {
      setState(s => ({ ...s, progress: { stage: 'error', message: 'Failed to add', progress: 0 } }));
    }
  }, [librariesQuery.data, addMutation, enrichMutation, onSuccess]);

  const closeProgress = useCallback(() => setState(s => ({ ...s, progressOpened: false })), []);

  return { ...state, handleAdd, closeProgress };
}
