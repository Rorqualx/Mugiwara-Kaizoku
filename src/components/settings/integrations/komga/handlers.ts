import type { KomgaFormValues } from './hooks';


export interface UpdateConfigParams {
  values: KomgaFormValues;
  mutateAsync: (params: { type: 'komga'; enabled: boolean; config: Record<string, unknown> }) => Promise<boolean>;
}

export function handleSubmit({ values, mutateAsync }: UpdateConfigParams): void {
  void mutateAsync({
    type: 'komga',
    enabled: values.enabled,
    config: {
      host: values.host,
      authMethod: values.authMethod,
      username: values.authMethod === 'basic' ? values.username : undefined,
      password: values.authMethod === 'basic' ? values.password : undefined,
      apiKey: values.authMethod === 'apikey' ? values.apiKey : undefined,
      syncInterval: values.syncInterval,
      autoSync: values.autoSync,
      syncDirection: values.syncDirection,
      libraries: values.libraries
    }
  });
}

export interface TestConnectionParams {
  values: KomgaFormValues;
  setIsTesting: (testing: boolean) => void;
  mutateAsync: (params: { host: string; authMethod: 'basic' | 'apikey'; username?: string | undefined; password?: string | undefined; apiKey?: string | undefined }) => Promise<{ success: boolean; message: string; serverInfo?: { version: string; buildDate: string } }>;
}

export function handleTestConnection({ values, setIsTesting, mutateAsync }: TestConnectionParams): void {
  setIsTesting(true);
  void mutateAsync({
    host: values.host,
    authMethod: values.authMethod,
    username: values.authMethod === 'basic' ? values.username : undefined,
    password: values.authMethod === 'basic' ? values.password : undefined,
    apiKey: values.authMethod === 'apikey' ? values.apiKey : undefined
  });
}

export interface SyncLibrary {
  id: string;
  [key: string]: unknown;
}

export interface SyncAllLibrariesParams {
  libraries: SyncLibrary[];
  mutateAsync: (params: { libraryId: string; deep: boolean }) => Promise<{ success: boolean; message: string }>;
}

/**
 * Syncs all libraries in parallel using Promise.allSettled
 * This fixes the ESLint no-await-in-loop violation
 */
export async function handleSyncAllLibraries({ libraries, mutateAsync }: SyncAllLibrariesParams): Promise<void> {
  const syncPromises = libraries.map(library =>
    mutateAsync({
      libraryId: library.id,
      deep: false
    })
  );

  const results = await Promise.allSettled(syncPromises);

  // Log any failures for debugging
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length > 0) {
    // Note: Errors are handled by the mutation's onError callback, so we don't log here
    // failures.map(f => String(f.reason))
  }
}
