/**
 * Types for Cover Selector Modal
 */

import type { ProviderMetadata } from '@/types/provider-metadata.types';

import type { Metadata as MangaMetadata } from '@prisma/client';


export interface CoverSelectorModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  currentCover: string;
  metadata?: MangaMetadata;
  providerMetadata?: ProviderMetadata | string;
  onCoverSelected?: (cover: string) => void;
}
