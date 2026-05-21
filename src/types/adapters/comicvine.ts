/**
 * ComicVine Adapter Types
 */

import type { BaseIntegrationConfig } from '../config.types';

// Define BaseAdapterConfig interface locally for this module
interface BaseAdapterConfig extends BaseIntegrationConfig {
  provider?: string;
  version?: string;
  features?: string[];
  maxRetries?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheDuration?: number;
}
/**
 * ComicVine configuration
 */
export interface ComicVineAdapterConfig extends BaseAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  preferredPublisher?: string;
  includeVariants?: boolean;
}

/**
 * ComicVine volume
 */
export interface ComicVineVolume {
  id: string;
  name: string;
  count_of_issues?: number;
  description?: string;
  deck?: string; // Short description
  image?: ComicVineImage;
  publisher?: ComicVinePublisher;
  start_year?: string;
  api_detail_url?: string;
  site_detail_url?: string;
  date_added?: string;
  date_last_updated?: string;
  resource_type?: string;
  // Extended properties from API responses
  characters?: ComicVineCharacter[];
  people?: ComicVineCreator[];
  first_issue?: ComicVineIssue;
  last_issue?: ComicVineIssue;
}

/**
 * ComicVine issue
 */
export interface ComicVineIssue {
  id: string;
  issue_number?: string;
  name?: string;
  description?: string;
  cover_date?: string;
  store_date?: string;
  image?: ComicVineImage;
  volume?: {
    id: string;
    name: string;
    api_detail_url?: string;
  };
  api_detail_url?: string;
  site_detail_url?: string;
}

/**
 * ComicVine image
 */
export interface ComicVineImage {
  icon_url?: string;
  medium_url?: string;
  screen_url?: string;
  screen_large_url?: string;
  small_url?: string;
  super_url?: string;
  thumb_url?: string;
  tiny_url?: string;
  original_url?: string;
}

/**
 * ComicVine publisher
 */
export interface ComicVinePublisher {
  id: string;
  name: string;
  api_detail_url?: string;
  site_detail_url?: string;
}

/**
 * ComicVine character
 */
export interface ComicVineCharacter {
  id: string;
  name: string;
  real_name?: string;
  aliases?: string;
  description?: string;
  image?: ComicVineImage;
  api_detail_url?: string;
  site_detail_url?: string;
}

/**
 * ComicVine creator
 */
export interface ComicVineCreator {
  id: string;
  name: string;
  role?: string;
  api_detail_url?: string;
  site_detail_url?: string;
}

/**
 * ComicVine search result
 */
export interface ComicVineSearchResult {
  id: string;
  name: string;
  description?: string;
  image?: ComicVineImage;
  resource_type?: string;
  count_of_issues?: number;
  publisher?: ComicVinePublisher;
  start_year?: string;
  api_detail_url?: string;
  site_detail_url?: string;
}

/**
 * ComicVine API response
 */
export interface ComicVineApiResponse<T> {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T | T[];
  version: string;
}

/**
 * ComicVine volume details
 */
export interface ComicVineVolumeDetails extends ComicVineVolume {
  aliases?: string;
  characters?: ComicVineCharacter[];
  concepts?: unknown[];
  count_of_issues?: number;
  date_added?: string;
  date_last_updated?: string;
  deck?: string;
  description?: string;
  first_issue?: ComicVineIssue;
  issues?: ComicVineIssue[];
  last_issue?: ComicVineIssue;
  locations?: unknown[];
  objects?: unknown[];
  people?: ComicVineCreator[];
  publisher?: ComicVinePublisher;
  teams?: unknown[];
}

/**
 * ComicVine issue details
 */
export interface ComicVineIssueDetails extends ComicVineIssue {
  aliases?: string;
  character_credits?: ComicVineCharacter[];
  concept_credits?: unknown[];
  cover_date?: string;
  date_added?: string;
  date_last_updated?: string;
  deck?: string;
  description?: string;
  has_staff_review?: boolean;
  location_credits?: unknown[];
  object_credits?: unknown[];
  person_credits?: ComicVineCreator[];
  store_date?: string;
  team_credits?: unknown[];
}

/**
 * ComicVine adapter instance config
 */
export interface ComicVineConfig extends ComicVineAdapterConfig {
  id: string;
  name: string;
  apiEndpoint?: string; // API endpoint URL
  throttleMs?: number;  // Throttle delay in milliseconds
}
