/**
 * Type Definitions for Chapter Orchestrator
 */

export type ProviderMetadataRecord = Record<string, unknown>;

export interface ImportProfile {
  primarySource?: string;
  chapterSource?: string;
  selectedChapters?: number;
  totalAvailableChapters?: number;
}

export interface SourceData {
  rawData?: { issues?: unknown[]; chapters?: unknown[] };
  metadata?: { issues?: unknown[]; chapters?: unknown[] };
  issues?: unknown[];
  volumeData?: unknown[];
  volumeDetails?: unknown;
  chapters?: unknown[];
  // Wikipedia-specific properties
  volumeList?: unknown[];
  chapterList?: unknown[];
}

export interface FandomData {
  volumeData?: Array<{ chapters?: unknown[] }>;
}

export interface RawProviderData {
  metadata?: ProviderMetadataRecord;
}

export interface ChapterEnrichment {
  summary?: string;
  coverImage?: string;
  pages?: number;
  releaseDate?: string;
  url?: string;
  title?: string;
  alternativeTitles?: string[];
}

export interface ChapterCreationFunctions {
  createChaptersFromVolumes: (ctx: unknown, id: number, volumes: unknown[], enrichment?: Record<number, ChapterEnrichment>) => Promise<void>;
  createFandomChapters: (ctx: unknown, id: number, data: unknown) => Promise<void>;
  createGenericChapters: (ctx: unknown, id: number, data: number | unknown[], volumeCount?: number | null) => Promise<void>;
}
