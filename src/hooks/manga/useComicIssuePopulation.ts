/**
 * Lazy issue population for ComicVine comicbook series.
 *
 * When the user opens a comicbook series detail page for the first time,
 * the Manga row exists but its Chapter rows (= ComicVine issues) haven't
 * been fetched yet. This hook fires a single `populateIssues` mutation
 * once the manga loads and meets the criteria, then triggers a refetch
 * so the chapter table reflects the new rows.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useComicvineConfig } from '@/hooks/useComicvineConfig';
import { trpc } from '@/utils/trpc-client/index';

interface MinimalManga {
  id: number;
  source?: string | null;
  mediaType?: string | null;
  Chapter?: { id: number }[] | null;
}

function shouldPopulate(manga: MinimalManga): boolean {
  if (manga.mediaType !== 'COMICBOOK' || manga.source !== 'comicvine') return false;
  const chapterCount = manga.Chapter?.length ?? 0;
  return chapterCount === 0;
}

export function useComicIssuePopulation(
  manga: MinimalManga | null | undefined,
  refetch: () => Promise<unknown> | unknown,
): { isPopulating: boolean } {
  const populateMutation = trpc.comicvine.populateIssues.useMutation();
  const triggeredFor = useRef<number | null>(null);
  const { config: cvConfig } = useComicvineConfig();
  const featureEnabled = cvConfig.comicbookTrackingEnabled;

  const handleSuccess = useCallback((populated: number): void => {
    if (populated > 0) void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!featureEnabled) return;
    if (!manga || !shouldPopulate(manga)) return;
    if (triggeredFor.current === manga.id) return;
    triggeredFor.current = manga.id;
    populateMutation.mutate(
      { mangaId: manga.id },
      { onSuccess: (result) => handleSuccess(result.populated) },
    );
  }, [featureEnabled, manga, populateMutation, handleSuccess]);

  return { isPopulating: populateMutation.isPending };
}
