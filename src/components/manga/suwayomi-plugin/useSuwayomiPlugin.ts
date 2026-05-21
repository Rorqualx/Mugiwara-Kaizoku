/**
 * Hook wrapping the per-manga Suwayomi plugin tRPC endpoints + the global
 * Suwayomi source-list query. Used by `SuwayomiPluginPanel`.
 */
import type { SuwayomiPluginConfig } from '@/server/services/suwayomi/manga-matcher';
import { trpc } from '@/utils/trpc-client/index';

interface UseSuwayomiPluginArgs {
  mangaId: number;
}

/** Shape accepted by the update mutation — partial of SuwayomiPluginConfig. */
export type SuwayomiPluginPatch = Partial<SuwayomiPluginConfig>;

interface SuwayomiSourceOption {
  id: string | number;
  name: string;
  lang: string;
}

export interface UseSuwayomiPluginReturn {
  config: SuwayomiPluginConfig | undefined;
  sources: SuwayomiSourceOption[];
  isLoadingConfig: boolean;
  isLoadingSources: boolean;
  isSaving: boolean;
  isMatching: boolean;
  isSyncing: boolean;
  matchResult: unknown;
  syncResult: unknown;
  error: string | null;
  updateConfig: (patch: SuwayomiPluginPatch) => void;
  runMatch: (sourceId?: string) => void;
  syncChapters: () => void;
}

export function useSuwayomiPlugin({ mangaId }: UseSuwayomiPluginArgs): UseSuwayomiPluginReturn {
  const utils = trpc.useUtils();

  const configQuery = trpc.manga.suwayomiGetPluginConfig.useQuery({ mangaId });
  const sourcesQuery = trpc.suwayomiV2.getSources.useQuery(undefined, {
    staleTime: 60_000,
  });

  const updateMutation = trpc.manga.suwayomiUpdatePluginConfig.useMutation({
    onSuccess: () => {
      void utils.manga.suwayomiGetPluginConfig.invalidate({ mangaId });
    },
  });

  const matchMutation = trpc.manga.suwayomiMatch.useMutation({
    onSuccess: () => {
      void utils.manga.suwayomiGetPluginConfig.invalidate({ mangaId });
    },
  });

  const syncMutation = trpc.manga.suwayomiSyncChapters.useMutation({
    onSuccess: () => {
      void utils.manga.suwayomiGetPluginConfig.invalidate({ mangaId });
    },
  });

  const sourcesPayload = sourcesQuery.data as { sources?: Array<{ id: string | number; name: string; lang: string }> } | undefined;
  const sourcesRaw = sourcesPayload?.sources ?? [];

  return {
    config: configQuery.data,
    sources: sourcesRaw,
    isLoadingConfig: configQuery.isLoading,
    isLoadingSources: sourcesQuery.isLoading,
    isSaving: updateMutation.isPending,
    isMatching: matchMutation.isPending,
    isSyncing: syncMutation.isPending,
    matchResult: matchMutation.data,
    syncResult: syncMutation.data,
    error:
      configQuery.error?.message
      ?? updateMutation.error?.message
      ?? matchMutation.error?.message
      ?? syncMutation.error?.message
      ?? null,
    updateConfig: (patch: SuwayomiPluginPatch): void => {
      updateMutation.mutate({ mangaId, patch });
    },
    runMatch: (sourceId?: string): void => {
      matchMutation.mutate(sourceId ? { mangaId, sourceId } : { mangaId });
    },
    syncChapters: (): void => {
      syncMutation.mutate({ mangaId });
    },
  };
}
