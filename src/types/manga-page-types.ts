import type {
  Manga,
  Chapter,
  Library,
  Metadata,
} from '@prisma/client';

export interface MangaWithRelations extends Manga {
  metadata?: Metadata | null;
  library: Library;
  chapters: Chapter[];
}

export interface ChapterWithManga extends Chapter {
  manga: Manga;
}

export interface MangaPageProps {
  manga: MangaWithRelations;
  chapters: Chapter[];
}

export interface MangaDetailProps {
  mangaId: number;
  onUpdate?: () => void;
}
