/**
 * Chapter Operations Types
 *
 * Type definitions for chapter extraction and recreation operations.
 * Supports Wikipedia, ComicVine, and Fandom providers.
 */

export interface ExtractedChapter {
  title: string;
  volumeNumber?: number | undefined;
  chapterNumber?: number | undefined;
  issueNumber?: number | undefined;
  coverImage?: string | null | undefined;
  description?: string | null | undefined;
  pages?: number | undefined;
  releaseDate?: Date | string | null | undefined;
  downloadUrl?: string | null | undefined;
  url?: string | undefined;
  alternativeTitles?: string[] | undefined;
}

export interface ChapterExtractionResult {
  chapters: ExtractedChapter[];
  shouldRecreate: boolean;
}
