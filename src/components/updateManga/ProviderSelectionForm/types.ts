/**
 * ProviderSelectionForm Types
 *
 * Type definitions specific to the ProviderSelectionForm component.
 * Shared types are imported from providerFormUtils.ts
 */

import type { MangaWithRelations } from '@/types/search.types';

import type { Manga, ProviderMetadataInfo } from '../providerFormUtils';
import type { Manga as MangaEntity } from '@prisma/client';

// Re-export commonly used types from providerFormUtils
export type {
  Manga,
  ProviderMetadataInfo,
  FieldData,
  SelectOption,
  FieldProviderOption,
  ProviderMetadataResult,
  ProviderMetadataItem,
  ProviderMetadata,
  MangaMetadata
} from '../providerFormUtils';

/**
 * Props for the ProviderSelectionForm component
 */
export interface ProviderSelectionFormProps {
  manga: MangaWithRelations | MangaEntity;
  onClose?: () => void;
  onUpdate: () => void;
}

/**
 * AniList staff member structure for type safety
 */
export interface AniListStaff {
  role: string;
  name: string;
}

/**
 * AniList character structure for type safety
 */
export interface AniListCharacter {
  name: string;
  role?: string;
}

/**
 * Extended Manga interface for TRPC response
 *
 * Includes additional fields that may be present in tRPC responses
 * that aren't part of the base Manga interface.
 */
export interface TRPCMangaResult extends Manga {
  createdAt?: Date | string;
  updatedAt?: Date | string;
  providerMetadata?: ProviderMetadataInfo | Array<{
    providerId: string;
    externalId?: string | number;
    metadata: Record<string, unknown>;
  }>;
}
