/**
 * Manga Type System - Single Source of Truth
 * 
 * This module establishes Prisma as the single source of truth for all Manga types.
 * All other types are derived from or mapped to the Prisma Manga model.
 * 
 * @module types/manga
 */

import type { Prisma, Manga as PrismaManga } from '@prisma/client';

// ============ Core Entity Types ============
// The single source of truth - Prisma's Manga model
export type MangaEntity = PrismaManga;

// With relations for different contexts
export type MangaWithChapters = Prisma.MangaGetPayload<{
  include: { Chapter: true }
}>;

export type MangaWithMetadata = Prisma.MangaGetPayload<{
  include: { Metadata: true }
}>;

export type MangaWithLibrary = Prisma.MangaGetPayload<{
  include: { Library: true }
}>;

export type MangaComplete = Prisma.MangaGetPayload<{
  include: {
    Chapter: true
    Metadata: true
    Library: true
    tasks: true
  }
}>;

// ============ Input Types for CRUD ============
export type MangaCreateInput = Prisma.MangaCreateInput;
export type MangaUpdateInput = Prisma.MangaUpdateInput;
export type MangaWhereInput = Prisma.MangaWhereInput;
export type MangaWhereUniqueInput = Prisma.MangaWhereUniqueInput;
export type MangaOrderByInput = Prisma.MangaOrderByWithRelationInput;

// ============ Partial Types ============
export type PartialManga = Partial<MangaEntity>;
export type MangaIdentifier = Pick<MangaEntity, 'id' | 'title'>;

// ============ Re-exports ============
export { MangaAdapter } from './adapters';
export type {
  MangaListView,
  MangaDetailView,
  MangaCardView,
  MangaOptionView,
  MangaFormData,
  MangaSearchResult
} from './views';
export type {
  ExternalAnilistManga,
  ExternalSuwayomiManga,
  ExternalMALManga,
  ExternalKitsuManga
} from './external';
export {
  isMangaEntity,
  isMangaWithChapters,
  isMangaComplete,
  isPartialManga
} from './guards';

// ============ Legacy Type Aliases (Deprecated) ============
// These are provided for backward compatibility during migration
// They will be removed in the next major version

/**
 * @deprecated Use MangaEntity instead
 */
export type Manga = MangaEntity;

/**
 * @deprecated Use PartialManga instead
 */
export type BaseManga = PartialManga;

/**
 * @deprecated Import directly from @prisma/client
 */
export type { 
  MangaPublicationStatus,
  MangaFileStatus,
  MangaLibraryStatus
} from '@prisma/client';