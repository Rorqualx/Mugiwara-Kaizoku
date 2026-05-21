import React from 'react';

import type { ProviderMetadataResponse } from '@/types/search.types';
import { trpc } from '@/utils/trpc-client/index';

interface UseProviderMetadataProps {
  opened: boolean;
  mangaId: number;
  provider: string;
}

interface UseProviderMetadataReturn {
  metadata: ProviderMetadataResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProviderMetadata({
  opened,
  mangaId,
  provider
}: UseProviderMetadataProps): UseProviderMetadataReturn {
  const getProviderMetadataMutation = trpc.manga.getProviderMetadata.useMutation();
  const [metadataResult, setMetadataResult] = React.useState<{ success: boolean; metadata: ProviderMetadataResponse } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (opened && mangaId && provider) {
      setIsLoading(true);
      getProviderMetadataMutation.mutateAsync({ mangaId, provider })
        .then(result => {
          setMetadataResult(result as { success: boolean; metadata: ProviderMetadataResponse });
          setError(null);
        })
        .catch(err => {
          setError(err as Error);
          setMetadataResult(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, [opened, mangaId, provider, getProviderMetadataMutation]);

  const refetch = React.useCallback((): Promise<void> => {
    if (mangaId && provider) {
      setIsLoading(true);
      return getProviderMetadataMutation.mutateAsync({ mangaId, provider })
        .then(result => {
          setMetadataResult(result as { success: boolean; metadata: ProviderMetadataResponse });
          setError(null);
        })
        .catch(err => {
          setError(err as Error);
        })
        .finally(() => setIsLoading(false));
    }
    return Promise.resolve();
  }, [mangaId, provider, getProviderMetadataMutation]);

  return {
    metadata: metadataResult?.metadata,
    isLoading,
    error,
    refetch
  };
}
