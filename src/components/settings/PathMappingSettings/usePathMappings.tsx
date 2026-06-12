/**
 * usePathMappings Hook
 *
 * Manages state and operations for download client path mappings.
 *
 * Extracted from: PathMappingSettings.tsx (lines 134-405)
 *
 * Features:
 * - Load existing mappings from database
 * - CRUD operations for path configurations
 * - Path validation/testing
 * - Client-specific path management
 */

import { useState, useEffect, startTransition } from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

import type { PathMappings, PathMapping } from './types';

export interface UsePathMappingsReturn {
  // State
  paths: PathMappings;
  isSaving: boolean;
  isTesting: boolean;

  // Actions
  handlePathChange: (client: keyof PathMappings, value: string) => void;
  handleSave: () => Promise<void>;
  handleTestAll: () => Promise<void>;

  // Data
  mappingsResult: unknown;
  refetch: () => void;
}

/**
 * Hook for managing download client path mappings
 */
export function usePathMappings(): UsePathMappingsReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Path configurations for each client
  const [paths, setPaths] = useState<PathMappings>({
    transmission: { downloadPath: '' },
    deluge: { downloadPath: '' },
    sabnzbd: { downloadPath: '' },
    nzbget: { downloadPath: '' }
  });

  // Queries - uses trpc.pathMapping directly, types come from AppRouter
  const { data: mappingsResult, refetch } = trpc.pathMapping.getAll.useQuery();

  // Utils for imperative query calls (testPath is a query, not mutation)
  const utils = trpc.useUtils();

  // Mutations
  const addMutation = trpc.pathMapping.add.useMutation();
  const removeMutation = trpc.pathMapping.remove.useMutation();

  // Load existing mappings on mount
  useEffect(() => {
    // mappingsResult is now the bare mapping array (errors surface via the
    // query's error channel); only proceed when data is present.
    if (Array.isArray(mappingsResult)) {
      const mappings = mappingsResult as PathMapping[];

      // Map existing database mappings to client fields
      const newPaths: PathMappings = {
        transmission: { downloadPath: '' },
        deluge: { downloadPath: '' },
        sabnzbd: { downloadPath: '' },
        nzbget: { downloadPath: '' }
      };

      mappings.forEach((mapping: PathMapping) => {
        if (mapping.source === 'database') {
          const desc = (mapping.description ?? '').toLowerCase();

          // Use localPath as the download path (we don't need remotePath anymore)
          if (desc.includes('transmission')) {
            newPaths.transmission = {
              downloadPath: mapping.localPath
            };
          } else if (desc.includes('deluge')) {
            newPaths.deluge = {
              downloadPath: mapping.localPath
            };
          } else if (desc.includes('sabnzbd')) {
            newPaths.sabnzbd = {
              downloadPath: mapping.localPath
            };
          } else if (desc.includes('nzbget')) {
            newPaths.nzbget = {
              downloadPath: mapping.localPath
            };
          }
        }
      });

      // Always update paths (setting to empty paths if no mappings found is fine)
      // Wrap in startTransition to avoid hydration issues with Suspense boundaries
      startTransition(() => {
        setPaths(newPaths);
      });
    }
  }, [mappingsResult]);

  // Handle input changes
  const handlePathChange = (client: keyof PathMappings, value: string): void => {
    setPaths((prev) => ({
      ...prev,
      [client]: {
        downloadPath: value
      }
    }));
  };

  // Handle save all mappings
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      // Remove all existing database mappings first (in reverse order to avoid index shifting)
      if (Array.isArray(mappingsResult)) {
        const mappings = mappingsResult as PathMapping[];
        const indicesToRemove: number[] = [];

        // Collect indices of database mappings
        for (let i = 0; i < mappings.length; i++) {
          const mapping = mappings[i];
          if (mapping?.source === 'database') {
            indicesToRemove.push(i);
          }
        }

        // Remove in reverse order to avoid index shifting issues
        for (let i = indicesToRemove.length - 1; i >= 0; i--) {
          const indexValue = indicesToRemove[i];
          if (indexValue !== undefined) {
            // eslint-disable-next-line no-await-in-loop -- Sequential execution required: must remove in reverse order to avoid index shifting as each deletion affects subsequent indices
            await removeMutation.mutateAsync({ index: indexValue });
          }
        }
      }

      // Add new mappings for each client that has paths configured
      const clients: Array<{ key: keyof PathMappings; name: string }> = [
        { key: 'transmission', name: 'Transmission' },
        { key: 'deluge', name: 'Deluge' },
        { key: 'sabnzbd', name: 'SABnzbd' },
        { key: 'nzbget', name: 'NZBGet' }
      ];

      for (const client of clients) {
        const config = paths[client.key];
        if (config.downloadPath.trim()) {
          // Use downloadPath for both remote and local (no translation needed)
          // The app will just scan/access this folder directly
          // eslint-disable-next-line no-await-in-loop -- Sequential execution required: mappings must be added after all removals are complete to maintain data consistency
          await addMutation.mutateAsync({
            remotePath: config.downloadPath.trim(),
            localPath: config.downloadPath.trim(),
            description: `${client.name} completed folder`
          });
        }
      }

      // Broaden invalidation: getAll cache reflects new mappings, but the browse
      // cache (used by FileOrgSettings + ManualImportModal) still has stale
      // directory listings keyed by the previous mapping resolution. Invalidate
      // the whole pathMapping namespace so any open browser modal refetches.
      await utils.pathMapping.invalidate();
      await refetch();

      showNotification({
        title: 'Paths Saved',
        message: 'Download client path mappings have been saved successfully',
        color: 'green',
        icon: <IconCheck />
      });
    } catch (error) {
      showNotification({
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save path mappings',
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Helper function to test a single path
   * Returns true if accessible, false otherwise
   * Uses utils.pathMapping.testPath.fetch() since testPath is a query, not mutation
   */
  const testSinglePath = async (path: string): Promise<boolean> => {
    try {
      const result = await utils.pathMapping.testPath.fetch({ path });
      return result.accessible;
    } catch (_error) {
      return false;
    }
  };

  // Handle test all paths
  const handleTestAll = async (): Promise<void> => {
    setIsTesting(true);
    const clients: Array<{ key: keyof PathMappings; name: string }> = [
      { key: 'transmission', name: 'Transmission' },
      { key: 'deluge', name: 'Deluge' },
      { key: 'sabnzbd', name: 'SABnzbd' },
      { key: 'nzbget', name: 'NZBGet' }
    ];

    // Test all paths in parallel since they are independent
    const testResults = await Promise.all(
      clients.map(async (client) => {
        const config = paths[client.key];
        if (!config.downloadPath.trim()) {
          return { success: false, skipped: true };
        }

        const isAccessible = await testSinglePath(config.downloadPath);
        return { success: isAccessible, skipped: false };
      })
    );

    // Aggregate results
    let successCount = 0;
    let failCount = 0;
    testResults.forEach((result) => {
      if (!result.skipped) {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    });

    setIsTesting(false);

    if (failCount === 0) {
      showNotification({
        title: 'All Paths Accessible',
        message: `Successfully verified ${successCount} path(s)`,
        color: 'green',
        icon: <IconCheck />
      });
    } else {
      showNotification({
        title: 'Some Paths Failed',
        message: `${successCount} accessible, ${failCount} not accessible`,
        color: 'yellow',
        icon: <IconAlertCircle />
      });
    }
  };

  return {
    // State
    paths,
    isSaving,
    isTesting,

    // Actions
    handlePathChange,
    handleSave,
    handleTestAll,

    // Data
    mappingsResult,
    refetch: () => void refetch()
  };
}
