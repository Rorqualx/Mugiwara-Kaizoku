/**
 * useMissingChaptersBatch
 *
 * After scan completes, gather every IN_LIBRARY row that carries files and
 * ask the server which of those files would create new chapters. Patches
 * each matching `MatchedMangaItem` with a `newChapters` count via the
 * `SET_MISSING_CHAPTERS_RESULTS` action.
 *
 * Fires exactly once per scan cycle (gated by `signature` of (libraryId,
 * scan complete flag, count of dup-with-files rows)).
 *
 * @module components/library/import-pipeline/hooks/useMissingChaptersBatch
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Dispatch } from 'react';

import type { MatchedMangaItem, PipelineAction } from '@/components/library/import-pipeline/types';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

interface Params {
  dispatch: Dispatch<PipelineAction>;
  matchedItems: Map<string, MatchedMangaItem>;
  isScanComplete: boolean;
  isActive: boolean;
}

interface DupCandidate {
  mangaId: number;
  files: Array<{ name: string; path: string }>;
}

/** Pull rows with isDuplicate + duplicateOfId + at least one file. */
function collectCandidates(matchedItems: Map<string, MatchedMangaItem>): DupCandidate[] {
  const byManga = new Map<number, DupCandidate>();
  for (const item of matchedItems.values()) {
    if (!item.isDuplicate || typeof item.duplicateOfId !== 'number') continue;
    if (!item.files || item.files.length === 0) continue;
    const existing = byManga.get(item.duplicateOfId);
    if (existing) {
      // Multiple rows per mangaId shouldn't happen post-Phase-1 dedup, but be safe.
      existing.files.push(...item.files.map((f) => ({ name: f.name, path: f.path })));
    } else {
      byManga.set(item.duplicateOfId, {
        mangaId: item.duplicateOfId,
        files: item.files.map((f) => ({ name: f.name, path: f.path })),
      });
    }
  }
  return Array.from(byManga.values());
}

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

async function fetchAndDispatch(
  utils: TrpcUtils,
  dispatch: Dispatch<PipelineAction>,
  candidates: DupCandidate[]
): Promise<void> {
  try {
    const res = await utils.client.library.computeMissingChapters.query({ items: candidates });
    dispatch({ type: 'SET_MISSING_CHAPTERS_RESULTS', results: res.results });
    logger.info('[MissingChapters] computed', {
      items: candidates.length,
      withNew: res.results.filter((r) => r.newChapters > 0).length,
    });
  } catch (err: unknown) {
    logger.error('[MissingChapters] compute failed', err, {});
  }
}

export function useMissingChaptersBatch(params: Params): void {
  const { dispatch, matchedItems, isScanComplete, isActive } = params;
  const utils = trpc.useUtils();
  const firedSignatureRef = useRef<string>('');

  // Signature changes only when the set of duplicate-with-files rows changes.
  const candidates = useMemo(() => collectCandidates(matchedItems), [matchedItems]);
  const signature = useMemo(() => {
    if (!isScanComplete || isActive) return '';
    if (candidates.length === 0) return '';
    const ids = candidates.map((c) => `${c.mangaId}:${c.files.length}`).sort();
    return ids.join(',');
  }, [candidates, isScanComplete, isActive]);

  useEffect(() => {
    if (!signature) return;
    if (firedSignatureRef.current === signature) return;
    firedSignatureRef.current = signature;
    void fetchAndDispatch(utils, dispatch, candidates);
  }, [signature, candidates, dispatch, utils]);
}
