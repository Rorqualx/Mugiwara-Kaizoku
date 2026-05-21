/**
 * Manga Detail Component - Barrel Export
 *
 * Re-exports MangaDetail component from refactored module structure.
 * Maintains backward compatibility with existing imports.
 *
 * Old: import { MangaDetail } from '@/components/mangaDetail';
 * New: import { MangaDetail } from '@/components/manga-detail'; (also works)
 *
 * This file ensures existing imports continue to work.
 */

export {
  MangaDetail,
  type MangaDetailProps,
  type MangaWithMetadataAndChapters,
} from "./manga-detail/index";
