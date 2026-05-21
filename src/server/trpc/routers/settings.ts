/**
 * Settings Router - Main Aggregator
 *
 * This router aggregates all settings-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - settings/utils.ts - Shared schemas, constants (0 procedures)
 * - settings/search.ts - Search provider configuration (7 procedures)
 * - settings/config.ts - Core config operations (3 procedures)
 * - settings/file-organization.ts - File organization settings (2 procedures)
 * - settings/backup.ts - Backup settings & operations (4 procedures)
 * - settings/integration.ts - Integration settings (2 procedures)
 *
 * Total: 18 procedures across 5 routers + metadata router
 *
 * Original file: 861 lines -> Refactored: ~80 lines (91% reduction)
 */

import { protectedProcedure } from '@/server/trpc/procedures';
import { metadataRouter } from '@/server/trpc/routers/metadata';
import { router } from '@/server/trpc/trpc';

import { settingsBackupRouter } from './settings/backup';
import { settingsConfigRouter } from './settings/config';
import { settingsFileOrganizationRouter } from './settings/file-organization';
import { settingsIntegrationRouter } from './settings/integration';
import { settingsSearchRouter } from './settings/search';
import { metadataProviders } from './settings/utils';

/**
 * Main settings router
 *
 * Merges all sub-routers to expose all procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 */
export const settingsRouter = router({
  // Re-export metadata router for backward compatibility
  metadata: metadataRouter,

  // Inline providers router (simple list)
  providers: router({
    list: protectedProcedure.query((): Array<{ id: string; name: string }> => {
      return [...metadataProviders];
    }),
  }),

  // Search provider configuration
  search: settingsSearchRouter,

  // Core config operations (get, getBatch, set)
  ...settingsConfigRouter._def.procedures,

  // File organization settings
  ...settingsFileOrganizationRouter._def.procedures,

  // Backup settings and operations
  ...settingsBackupRouter._def.procedures,

  // Integration settings
  ...settingsIntegrationRouter._def.procedures,
});
