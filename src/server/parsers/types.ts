/**
 * Parser Type Definitions
 * 
 * Core types for the unified parser system
 */

export type ProviderType = 
  | 'FANDOM' 
  | 'WIKIPEDIA' 
  | 'MYANIMELIST' 
  | 'ANILIST' 
  | 'GENERIC';

export interface ParseResult {
  title: string;
  author?: string;
  status?: string;
  description?: string;
  synopsis?: string;
  coverImage?: string;
  images?: string[];
  chapters?: ChapterInfo[];
  metadata?: unknown;
  content?: string;
  sections?: SectionInfo[];
  genres?: string[];
  tags?: string[];
  statistics?: unknown;
  nativeTitle?: string;
}

export interface ChapterInfo {
  number: number | string;
  title?: string;
  url?: string;
  date?: string;
}

export interface SectionInfo {
  title: string;
  content: string;
}

export interface CachedParseOptions {
  html?: string;
  provider?: ProviderType;
  forceRefresh?: boolean;
  cacheTTL?: number;
  extractImages?: boolean;
  extractMetadata?: boolean;
  extractChapters?: boolean;
  includeMetadata?: boolean;
  timeout?: number;
  maxRetries?: number;
}