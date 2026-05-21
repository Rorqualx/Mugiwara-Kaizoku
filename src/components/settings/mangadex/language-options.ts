/**
 * Shared MangaDex language options.
 *
 * Used by both the indexer-side (`MangaDexDownloadSettings`) and metadata-side
 * (`MangaDexMetadataSettings`) settings forms to keep the option lists in sync.
 */

export interface MangaDexLanguageOption {
  value: string;
  label: string;
}

export const MANGADEX_LANGUAGE_OPTIONS: readonly MangaDexLanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'zh-hk', label: 'Chinese (Traditional)' },
  { value: 'es', label: 'Spanish' },
  { value: 'es-la', label: 'Spanish (Latin America)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pt-br', label: 'Portuguese (Brazil)' },
  { value: 'ru', label: 'Russian' },
  { value: 'pl', label: 'Polish' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'th', label: 'Thai' },
  { value: 'ar', label: 'Arabic' },
];
