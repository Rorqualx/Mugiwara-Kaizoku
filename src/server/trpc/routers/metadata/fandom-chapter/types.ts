/**
 * Shared types for Fandom chapter metadata extraction
 */

export interface ChapterMetadata {
  coverImageUrl?: string;
  description?: string;
  summary?: string;
  synopsis?: string;
  title?: string;
  chapterNumber?: string;
  releaseDate?: string;
  pageCount?: number;
}

export interface ImageScoringContext {
  chapterNumberFromUrl: string | null;
  selector: string;
}
