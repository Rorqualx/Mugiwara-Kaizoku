/**
 * ComicVine API types
 */

/** ComicVine API response wrapper */
export interface ComicVineResponse<T> {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T;
  version: string;
}

/** Image at multiple sizes */
export interface CVImage {
  icon_url?: string;
  medium_url?: string;
  screen_url?: string;
  screen_large_url?: string;
  small_url?: string;
  super_url?: string;
  thumb_url?: string;
  tiny_url?: string;
  original_url?: string;
  image_tags?: string;
}

/** Publisher */
export interface CVPublisher {
  api_detail_url: string;
  id: number;
  name: string;
  site_detail_url?: string;
}

/** Person credit */
export interface CVPersonCredit {
  api_detail_url: string;
  id: number;
  name: string;
  site_detail_url?: string;
  role?: string;
}

/** Character credit */
export interface CVCharacterCredit {
  api_detail_url: string;
  id: number;
  name: string;
  site_detail_url?: string;
}

/** Concept credit */
export interface CVConceptCredit {
  api_detail_url: string;
  id: number;
  name: string;
  site_detail_url?: string;
}

/** Story arc credit */
export interface CVStoryArcCredit {
  api_detail_url: string;
  id: number;
  name: string;
  site_detail_url?: string;
}

/** Genre */
export interface CVGenre {
  api_detail_url: string;
  id: number;
  name: string;
  site_detail_url?: string;
}

/** Volume (manga series) */
export interface CVVolume {
  id: number;
  api_detail_url: string;
  site_detail_url: string;
  name: string;
  aliases?: string;
  count_of_issues: number;
  date_added: string;
  date_last_updated: string;
  deck?: string;
  description?: string;
  image: CVImage;
  publisher?: CVPublisher;
  start_year?: string;
  first_issue?: { id: number; name: string; issue_number: string };
  last_issue?: { id: number; name: string; issue_number: string };
  genres?: CVGenre[];
  characters?: CVCharacterCredit[];
  concepts?: CVConceptCredit[];
  people?: CVPersonCredit[];
  story_arcs?: CVStoryArcCredit[];
}

/** Issue (individual volume/chapter) */
export interface CVIssue {
  id: number;
  api_detail_url: string;
  site_detail_url: string;
  name?: string;
  issue_number: string;
  volume: { id: number; name: string; api_detail_url: string };
  date_added: string;
  date_last_updated: string;
  cover_date?: string;
  deck?: string;
  description?: string;
  image: CVImage;
  person_credits?: CVPersonCredit[];
  character_credits?: CVCharacterCredit[];
  story_arc_credits?: CVStoryArcCredit[];
  concept_credits?: CVConceptCredit[];
  has_staff_review?: boolean;
}

/** Search result item (volume search) */
export interface CVSearchResult {
  id: number;
  resource_type: string;
  name: string;
  aliases?: string;
  deck?: string;
  image: CVImage;
  count_of_issues?: number;
  publisher?: CVPublisher;
  start_year?: string;
  api_detail_url: string;
  site_detail_url: string;
}
