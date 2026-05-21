/**
 * Provider Metadata Type Definitions
 *
 * Type-safe interfaces for manga metadata from various providers
 * (AniList, ComicVine, Fandom, Wikipedia)
 */

/**
 * Image option for cover/banner selection
 */
export interface ImageOption {
  url: string;
  label: string;
  type: 'cover' | 'banner' | 'gallery';
  category?: 'wizard' | 'gallery' | 'volume' | 'chapter' | 'provider' | 'metadata';
  size?: 'small' | 'medium' | 'large' | 'extraLarge';
  provider?: string;
  volumeNumber?: number;
  chapterNumber?: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Image category for organizing images in UI
 */
export interface ImageCategory {
  id: string;
  label: string;
  images: ImageOption[];
  type: 'cover' | 'banner' | 'gallery';
  count: number;
}

/**
 * Wizard-selected images from import process
 */
export interface WizardSelectedImages {
  allImages?: string[];
  galleryImages?: string[];
  volumeCovers?: string[];
  selectedCover?: string;
  selectedBanner?: string;
}

/**
 * Raw provider data with selected gallery images
 */
export interface RawProviderData {
  selectedGalleryImages?: string[];
  [key: string]: unknown;
}

/**
 * Fandom chapter data
 */
export interface FandomChapter {
  chapterNumber?: number;
  number?: number;
  title?: string;
  coverImage?: string;
  coverImageUrl?: string;
  summary?: string;
  description?: string;
  synopsis?: string;
  releaseDate?: string;
  pages?: number;
  url?: string;
  detailsFetched?: boolean;
}

/**
 * Fandom volume data
 */
export interface FandomVolume {
  volumeNumber?: number;
  number?: number;
  title?: string;
  name?: string;
  coverImage?: string;
  coverImageUrl?: string;
  cover?: string;
  chapters?: FandomChapter[];
}

/**
 * Fandom metadata structure
 */
export interface FandomMetadata {
  volumeData?: FandomVolume[];
  volumeDetails?: FandomVolume[];
  gallery?: Array<string | { url: string; caption?: string }>;
  metadata?: {
    volumeDetails?: FandomVolume[];
  };
}

/**
 * Fandom gallery data
 */
export interface FandomGallery {
  gallery?: Array<string | { url: string; caption?: string }>;
}

/**
 * ComicVine issue data
 */
export interface ComicVineIssue {
  issue_number?: number;
  issueNumber?: number;
  name?: string;
  title?: string;
  image?: {
    original_url?: string;
    medium_url?: string;
    small_url?: string;
    thumb_url?: string;
  };
}

/**
 * ComicVine metadata structure
 */
export interface ComicVineMetadata {
  metadata?: {
    issues?: ComicVineIssue[];
  };
  image?: {
    original_url?: string;
    medium_url?: string;
    small_url?: string;
  };
  issues?: ComicVineIssue[];
}

/**
 * AniList cover image structure
 */
export interface AniListCoverImage {
  extraLarge?: string;
  large?: string;
  medium?: string;
  small?: string;
  color?: string;
}

/**
 * AniList metadata structure
 */
export interface AniListMetadata {
  coverImage?: AniListCoverImage;
  bannerImage?: string;
  title?: {
    english?: string;
    romaji?: string;
    native?: string;
  };
}

/**
 * Wikipedia metadata structure
 */
export interface WikipediaMetadata {
  thumbnail?: string;
  image?: string;
  images?: string[];
}

/**
 * Generic provider metadata with "Use This" selection
 */
export interface SelectedProviderMetadata {
  cover?: string;
  coverImage?: string;
  bannerImage?: string;
  metadata?: {
    cover?: string;
    coverImage?: string;
    bannerImage?: string;
  };
}

/**
 * Complete provider metadata container
 */
export interface ProviderMetadata {
  // Wizard selections
  selected_images?: WizardSelectedImages;

  // Selected gallery images (from rawProviderData)
  selectedGalleryImages?: string[];

  // Provider data
  fandom?: FandomMetadata;
  fandom_volumes?: FandomMetadata;
  fandom_chapters?: FandomMetadata;
  fandom_gallery?: FandomGallery | Array<string | { url: string; caption?: string }>;
  FANDOM?: FandomMetadata;

  comicvine?: ComicVineMetadata;
  comicvine_volumes?: ComicVineMetadata;

  anilist?: AniListMetadata;

  wikipedia?: WikipediaMetadata;
  wikipedia_chapters?: WikipediaMetadata;

  // Selected providers (with _selected suffix)
  [key: string]: unknown;
}

/**
 * Type guard to check if a key represents a selected provider
 */
export function isSelectedProviderKey(key: string): boolean {
  return key.endsWith('_selected');
}

/**
 * Extract provider name from selected provider key
 */
export function getProviderNameFromKey(key: string): string {
  return key.replace('_selected', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
