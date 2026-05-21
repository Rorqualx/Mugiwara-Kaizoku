/**
 * Type Definitions for ComicVine Metadata
 *
 * Defines interfaces for ComicVine issue and volume responses.
 */

export interface IssueResult {
  id: number;
  name?: string;
  description?: string;
  coverImages?: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  coverDate?: string;
  storeDate?: string;
  volume?: {
    id: number;
    name?: string;
  };
  characterCredits?: Array<{
    id: number;
    name?: string;
  }>;
  personCredits?: Array<{
    id: number;
    name?: string;
    role?: string;
  }>;
}

/** Cover image URLs in multiple sizes */
export interface CoverImages {
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}

/** Issue with cover image data and description */
export interface IssueWithCover {
  id: number;
  name?: string;
  issueNumber?: string;
  coverImages?: CoverImages;
  description?: string;
  deck?: string;
  coverDate?: string;
  storeDate?: string;
  siteDetailUrl?: string;
}

export interface VolumeResult {
  id: number;
  name?: string;
  description?: string;
  coverImages?: CoverImages;
  publisher?: {
    id: number;
    name?: string;
  };
  startYear?: number;
  issueCount?: number;
  issues?: IssueWithCover[];
  characters?: Array<{
    id: number;
    name?: string;
  }>;
  creators?: Array<{
    id: number;
    name?: string;
    role?: string;
  }>;
  firstIssue?: {
    id: number;
    name?: string;
    issueNumber?: string;
  };
  lastIssue?: {
    id: number;
    name?: string;
    issueNumber?: string;
  };
  dateAdded?: string;
  dateLastUpdated?: string;
}
