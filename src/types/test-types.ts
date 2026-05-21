/**
 * Type definitions for test files
 * 
 * This file provides common type definitions for test files to improve
 * type safety and eliminate unsafe type assertions.
 */

import type { EventLevel, EventSource, EventType } from '../server/services/events/eventTypes';
import type { UserRole } from '@prisma/client';

// Define minimal types for testing to avoid Next.js import issues
interface NextApiRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  cookies?: Record<string, string>;
}

interface NextApiResponse<T = unknown> {
  status: (code: number) => NextApiResponse<T>;
  json: (data: T) => void;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string | string[] | number) => NextApiResponse<T>;
  end: () => void;
}

/**
 * Partial NextApiRequest for testing
 */
export interface TestApiRequest extends Partial<NextApiRequest> {
  headers: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

/**
 * Partial NextApiResponse for testing
 */
export interface TestApiResponse extends Partial<NextApiResponse> {
  [key: string]: unknown;
}

/**
 * User context for TRPC tests
 */
export interface TestUserContext {
  id: string;
  role: UserRole;
  [key: string]: unknown;
}

/**
 * TRPC context for testing
 */
export interface TestTRPCContext {
  req: TestApiRequest;
  res: TestApiResponse;
  user?: TestUserContext;
}

/**
 * Event object for tests
 */
export interface TestEvent {
  id: number;
  type: EventType;
  source: EventSource;
  level: EventLevel;
  message: string;
  details?: Record<string, unknown>;
  relatedID?: string;
  relatedEntityType?: string;
  timestamp: Date;
  userId?: string | null;
}

/**
 * Event response for tests
 */
export interface TestEventResponse {
  events: TestEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Event settings for tests
 */
export interface TestEventSettings {
  id: number;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AniList settings for tests
 */
export interface TestAniListSettings {
  id: number;
  metadata: string;
  [key: string]: unknown;
}

/**
 * AniList manga response for tests
 */
export interface TestAniListManga {
  id: number;
  title: {
    romaji?: string;
    english?: string;
    native?: string;
  };
  description?: string;
  coverImage?: {
    large?: string;
    medium?: string;
  };
  status?: string;
  genres?: string[];
  tags?: Array<{
    name: string;
    category?: string;
    rank?: number;
  }>;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  } | null;
  chapters?: number | null;
  volumes?: number | null;
  averageScore?: number;
  popularity?: number;
  isAdult?: boolean;
  countryOfOrigin?: string;
  source?: string;
  synonyms?: string[];
  staff?: {
    nodes: Array<{
      id: number;
      name: {
        full: string;
      };
      description?: string;
    }>;
  };
  characters?: {
    nodes: Array<{
      id: number;
      name: {
        full: string;
      };
      description?: string;
    }>;
  };
  [key: string]: unknown;
}

/**
 * Task object for tests
 */
export interface TestTask {
  id: number;
  type: string;
  status: string;
  priority: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  [key: string]: unknown;
}

/**
 * Settings object for tests
 */
export interface TestSettings {
  id: number;
  metadata: string | Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

/**
 * Manga object for tests
 */
export interface TestManga {
  id: number;
  title: string;
  metadata?: {
    id: number;
    sourceId?: string;
    source?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}