/**
 * Store Actions Hook
 *
 * Re-exports from decomposed module structure.
 * See ./useStoreActions/ for implementation.
 *
 * @module store/useStoreActions
 */

export { useStoreActions } from './useStoreActions/index';
export type {
  MangaWithRelations,
  UpdatedManga,
  IntegrationSettingKey,
  SettingsUpdateInput,
  UseStoreActionsReturn,
} from './useStoreActions/types';
export { isValidMetadata, isRecord } from './useStoreActions/type-guards';
export type { ValidMetadata } from './useStoreActions/type-guards';
