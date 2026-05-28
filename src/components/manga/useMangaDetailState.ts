/**
 * MangaDetailView State Management Hook
 *
 * Manages UI toggles + the metadata-conflicts query for the manga detail page.
 * Conflicts are fetched via trpc.metadata.getConflicts (onlyUnresolved=true) and
 * exposed as AsyncResult so the existing MetadataBadges / MangaDetailBanner
 * consumers can keep using isLoading/isSuccess helpers unchanged.
 */

import { useMemo, useState } from 'react';

import type { MetadataConflict } from '@/types/metadata-types';
import type { AsyncResult } from '@/utils/async-result';
import {
  createErrorResult,
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
} from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client';

import type { MangaDetailState } from './MangaDetailTypes';

export function useMangaDetailState(
  mangaId: number | undefined,
  onRefreshMetadata?: () => void
): MangaDetailState {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isSynonymsExpanded, setIsSynonymsExpanded] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  const utils = trpc.useUtils();
  const conflictsQuery = trpc.metadata.getConflicts.useQuery(
    { mangaId: mangaId ?? 0, onlyUnresolved: true },
    { enabled: mangaId !== undefined && mangaId > 0 },
  );

  const conflictsState = useMemo<AsyncResult<MetadataConflict[], Error>>(() => {
    if (mangaId === undefined || mangaId <= 0) return createIdleResult();
    if (conflictsQuery.isLoading) return createLoadingResult();
    if (conflictsQuery.error) {
      const err = conflictsQuery.error;
      return createErrorResult(err instanceof Error ? err : new Error(String(err)));
    }
    return createSuccessResult<MetadataConflict[], Error>(conflictsQuery.data ?? []);
  }, [mangaId, conflictsQuery.isLoading, conflictsQuery.error, conflictsQuery.data]);

  const conflictsCount = conflictsQuery.data?.length ?? 0;

  const handleConflictsResolved = (): void => {
    if (mangaId !== undefined && mangaId > 0) {
      void utils.metadata.getConflicts.invalidate({ mangaId, onlyUnresolved: true });
    }
    onRefreshMetadata?.();
  };

  return {
    isDescriptionExpanded,
    setIsDescriptionExpanded,
    isSynonymsExpanded,
    setIsSynonymsExpanded,
    isConflictModalOpen,
    setIsConflictModalOpen,
    conflictsState,
    conflictsCount,
    handleConflictsResolved
  };
}
