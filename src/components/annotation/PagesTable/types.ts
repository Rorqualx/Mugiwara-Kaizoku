/**
 * PagesTable Types
 */

export interface TrainingDiscoveredUrl {
  type: string;
  url: string;
  categoryName?: string | undefined;
}

export interface PageListItem {
  id: string;
  url: string;
  mangaTitle: string | null;
  sourceType: string;
  status: string;
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Training data fields
  comicVineId?: string | null;
  fandomBaseUrl?: string | null;
  wikipediaBaseUrl?: string | null;
  fandomDiscoveredUrls?: TrainingDiscoveredUrl[];
  wikipediaDiscoveredUrls?: TrainingDiscoveredUrl[];
  comicVineDiscoveredUrls?: TrainingDiscoveredUrl[];
}

export interface PageGroup {
  key: string;
  displayName: string;
  sourceType: string;
  pages: PageListItem[];
  totalTokens: number;
  // Aggregated training data for group
  comicVineId?: string | null | undefined;
  fandomDiscoveredCount: number;
  wikipediaDiscoveredCount: number;
  comicVineDiscoveredCount: number;
}
