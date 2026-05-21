/**
 * File Organization Settings Router
 *
 * Handles file organization configuration including folder structure,
 * naming templates, and import settings.
 *
 * Procedures:
 * - getFileOrganization: Get file organization settings
 * - updateFileOrganization: Update file organization settings
 *
 * Extracted from: settings.ts (lines 590-647)
 */

import { TRPCError } from '@trpc/server';

import {
  getGeneralConfigService,
  type FileOrganizationSettings,
} from '@/server/services/config/generalConfigService';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError,
} from '@/utils/async-result';
import { logger } from '@/utils/logging';

import { fileOrganizationSchema } from './utils';

export const settingsFileOrganizationRouter = router({
  /**
   * Get file organization settings procedure
   *
   * Retrieves the current file organization settings.
   *
   * @returns The file organization settings
   */
  getFileOrganization: protectedProcedure.query(async () => {
    try {
      const configService = getGlobalConfigService();
      const generalConfigService = getGeneralConfigService(configService);
      const settings = await generalConfigService.getFileOrganizationSettings();
      return createSuccessResult(settings);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error getting file organization settings: ${errorMessage}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
      });
    }
  }),

  /**
   * Update file organization settings procedure
   *
   * Updates the file organization settings.
   *
   * @param settings - The file organization settings to update
   * @returns Whether the update was successful
   */
  updateFileOrganization: protectedProcedure
    .input(fileOrganizationSchema)
    .mutation(async ({ input }): Promise<AsyncResult<boolean, Error>> => {
      try {
        const configService = getGlobalConfigService();
        const generalConfigService = getGeneralConfigService(configService);
        const fileOrgData: Record<string, unknown> = {
          folderStructure: input.folderStructure,
          fileNamingTemplate: input.fileNamingTemplate,
          createMetadataFiles: input.createMetadataFiles,
          organizeOnImport: input.organizeOnImport,
          fileMode: input.fileMode,
        };
        if (input.customFolderTemplate !== undefined) {
          fileOrgData['customFolderTemplate'] = input.customFolderTemplate;
        }
        await generalConfigService.updateFileOrganization(
          fileOrgData as Partial<FileOrganizationSettings>
        );
        return createSuccessResult(true);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `Error updating file organization settings: ${errorMessage}`
        );
        return createErrorResult(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),
});
