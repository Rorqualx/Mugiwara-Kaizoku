/**
 * Unified metadata types matching Kaizoku's data model
 */

import {
  UUID,
  LanguageCode,
  DataSource,
  PublicationStatus,
  ContentRating,
  PublicationDemographic,
  MangaFormat,
  CreatorRole,
  CharacterRole,
  RelationType,
  EnrichmentTier,
} from './common';

/** Multi-language string map */
export type LocalizedString = Record<LanguageCode, string>;

/** Cover images at multiple sizes */
export interface CoverImages {
  original?: string;
  large?: string;    // 512px or extraLarge
  medium?: string;   // 256px or large
  small?: string;    // AniList medium
  color?: string;    // AniList dominant color
}

/** Creator (author/artist) */
export interface Creator {
  id?: string;
  name: string;
  nativeName?: string;
  role: CreatorRole;
  imageUrl?: string;
  bio?: string;
  source: DataSource;
}

/** Character */
export interface Character {
  id?: string;
  name: string;
  nativeName?: string;
  role: CharacterRole;
  isMain: boolean;
  imageUrl?: string;
  description?: string;
  gender?: string;
  age?: string;
  source: DataSource;
}

/** Story arc (from ComicVine) */
export interface StoryArc {
  id: string;
  name: string;
  description?: string;
  source: DataSource;
}

/** External links mapped by site */
export interface ExternalLinks {
  anilist?: string;
  myAnimeList?: string;
  mangaUpdates?: string;
  animePlanet?: string;
  bookWalker?: string;
  kitsu?: string;
  amazon?: string;
  eBookJapan?: string;
  raw?: string;
  englishTranslation?: string;
  comicVine?: string;
  [key: string]: string | undefined;
}

/** Related manga */
export interface MediaRelation {
  id: string;
  title: string;
  relationType: RelationType;
  format?: MangaFormat;
  status?: PublicationStatus;
  coverImage?: string;
  source: DataSource;
}

/** Manga recommendation */
export interface Recommendation {
  id: string;
  title: string;
  rating: number;
  coverImage?: string;
  source: DataSource;
}

/** Score/rating info */
export interface ScoreInfo {
  averageScore?: number;     // 0-100 scale
  meanScore?: number;
  ratingDistribution?: Record<string, number>;
  follows?: number;
  popularity?: number;
  trending?: number;
}

/** Unified manga metadata */
export interface UnifiedManga {
  /** Source-specific IDs */
  ids: Partial<Record<DataSource, string>>;

  /** Titles */
  title: LocalizedString;
  altTitles: string[];

  /** Description */
  description: LocalizedString;

  /** Images */
  covers: CoverImages;
  bannerImage?: string;

  /** Classification */
  genres: string[];
  themes: string[];
  tags: string[];
  contentRating?: ContentRating;
  demographic?: PublicationDemographic;
  format?: MangaFormat;

  /** Status & dates */
  status?: PublicationStatus;
  startDate?: string;       // ISO date or partial (YYYY, YYYY-MM, YYYY-MM-DD)
  endDate?: string;
  year?: number;

  /** Counts */
  totalChapters?: number;
  totalVolumes?: number;

  /** People & characters */
  creators: Creator[];
  characters: Character[];

  /** Publishing */
  publisher?: string;
  originalLanguage?: LanguageCode;
  countryOfOrigin?: string;
  availableLanguages: LanguageCode[];

  /** Score & popularity */
  score?: ScoreInfo;

  /** Relations */
  relations: MediaRelation[];
  recommendations: Recommendation[];
  storyArcs: StoryArc[];

  /** External links */
  externalLinks: ExternalLinks;

  /** Volumes & chapters */
  volumes: UnifiedVolume[];
  chapters: UnifiedChapter[];

  /** Metadata about the metadata */
  sources: DataSource[];
  lastUpdated: string;
}

/** Unified volume metadata */
export interface UnifiedVolume {
  id?: string;
  volumeNumber: string;
  title?: string;
  description?: string;

  /** Images */
  coverImage?: string;
  covers?: CoverImages;

  /** Content */
  chapterRange?: string;        // e.g. "1-10"
  chapterCount?: number;
  startChapter?: string;
  endChapter?: string;

  /** People */
  creators: Creator[];
  characters: Character[];

  /** Publishing */
  releaseDate?: string;
  isbn?: string;
  pageCount?: number;

  /** Source tracking */
  source: DataSource;
}

/** Unified chapter metadata */
export interface UnifiedChapter {
  id?: string;
  chapterNumber?: string;
  title?: string;
  volume?: string;

  /** Content */
  pages: number;
  imageUrls?: string[];

  /** Language */
  language: LanguageCode;

  /** Dates */
  publishedAt?: string;
  readableAt?: string;
  createdAt?: string;
  updatedAt?: string;

  /** Attribution */
  scanlationGroup?: string;
  uploader?: string;
  externalUrl?: string;

  /** Source tracking */
  source: DataSource;
}

/** Enriched metadata with completeness info */
export interface EnrichedMetadata {
  manga: UnifiedManga;
  completeness: CompletenessScore;
  tier: EnrichmentTier;
  errors: Array<{ source: DataSource; error: string }>;
  timing: {
    totalMs: number;
    perSource: Partial<Record<DataSource, number>>;
  };
}

/** Completeness scoring */
export interface CompletenessScore {
  overall: number;          // 0-100
  fields: Record<string, boolean>;
  missingFields: string[];
  sourceCoverage: Partial<Record<DataSource, number>>;
}
