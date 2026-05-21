/**
 * Manga Detail Component - Barrel Export (Backward Compatibility)
 *
 * Re-exports MangaDetail component from the refactored modular structure.
 * This file maintains backward compatibility with existing imports.
 *
 * Old: import { MangaDetail } from '@/components/mangaDetail';
 * New: import { MangaDetail } from '@/components/manga-detail';
 *
 * Both import paths work - prefer the new path for new code.
 */

export {
  MangaDetail,
  type MangaDetailProps,
  type MangaWithMetadataAndChapters,
} from "./manga-detail";
