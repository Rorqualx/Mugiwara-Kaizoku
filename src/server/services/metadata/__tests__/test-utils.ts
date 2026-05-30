/**
 * Shared Test Foundation Module for Metadata Service Tests
 *
 * Provides type-safe test utilities, mock factories, and helper functions
 * to eliminate code duplication and fix ESLint no-unsafe-return/no-unsafe-call errors.
 *
 * @module test-utils
 */

import { isObject } from '@/utils/type-guards';

import type { Manga, Metadata, MangaPublicationStatus } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/** Captured metadata data structure for test assertions */
export interface CapturedMetadataData {
  summary?: string;
  cover?: string;
  coverExtraLarge?: string;
  coverLarge?: string;
  coverMedium?: string;
  coverSmall?: string;
  genres?: string[];
  authors?: string[];
  artists?: string[];
  tags?: string[];
  characters?: string[];
  synonyms?: string[];
  urls?: string[];
  chapters?: number;
  volumes?: number;
  idMal?: number;
  averageScore?: number;
  popularity?: number;
  countryOfOrigin?: string;
  publisher?: string;
  bannerImage?: string;
  format?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  lastFetch?: Date;
  [key: string]: unknown;
}

/** Type-safe mock transaction client */
export interface MockTransactionClient {
  manga: { findUnique: jest.Mock; update: jest.Mock };
  metadata: { create: jest.Mock; update: jest.Mock };
}

/** Type for Prisma transaction callback parameter */
export type TransactionCallback<T> = (tx: MockTransactionClient) => Promise<T>;

/** Interface for captured provider metadata in tests */
export interface CapturedProviderMetadata {
  metadataProvenance?: Record<string, string>;
  existingData?: unknown;
  [key: string]: unknown;
}

/** Test metadata data structure with index signature */
export interface TestMetadataData {
  data?: unknown;
  startDate?: Date;
  endDate?: Date;
  genres?: string[];
  authors?: string[];
  artists?: string[];
  tags?: string[];
  cover?: string;
  coverLarge?: string;
  coverMedium?: string;
  coverSmall?: string;
  coverExtraLarge?: string;
  lastFetch?: Date;
  [key: string]: unknown;
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Creates a mock Prisma transaction client with type-safe Jest mocks */
export function createMockTransactionClient(): MockTransactionClient {
  return {
    manga: { findUnique: jest.fn(), update: jest.fn() },
    metadata: { create: jest.fn(), update: jest.fn() }
  };
}

/**
 * Creates a type-safe mock for Prisma $transaction.
 * Fixes no-unsafe-return ESLint errors by providing proper typing.
 */
export function createTypedTransactionMock<T>(
  implementation: (tx: MockTransactionClient) => Promise<T>
): (callback: TransactionCallback<T>) => Promise<T> {
  return async (callback: TransactionCallback<T>): Promise<T> => {
    const tx = createMockTransactionClient();
    await implementation(tx);
    return callback(tx);
  };
}

/** Creates a mock manga object with sensible defaults */
export function createMockManga(overrides?: Partial<Manga>): Manga {
  return {
    id: 1,
    title: 'Test Manga',
    metadataId: null,
    providerMetadata: {},
    source: 'test',
    sourceId: 'test-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    libraryId: 1,
    libraryPath: '/path/to/manga',
    fileStatus: 'COMPLETED',
    libraryStatus: 'ACTIVE',
    publicationStatus: 'COMPLETED',
    lastChecked: null,
    mangaTitle: null,
    errorMessage: null,
    lastErrorAt: null,
    lastSyncAt: null,
    summary: null,
    syncCount: 0,
    searchProvider: 'anilist',
    monitoringConfig: null,
    metadataConfidence: null,
    mlCorrected: null,
    selectedSourceId: null,
    rawProviderData: null,
    suwayomiPluginConfig: null,
    mediaType: 'MANGA',
    ...overrides
  };
}

/** Creates a mock metadata object with sensible defaults */
export function createMockMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    id: 100,
    cover: '/test-cover.jpg',
    summary: 'Test summary',
    genres: [],
    authors: [],
    artists: [],
    tags: [],
    themes: [],
    synonyms: [],
    urls: [],
    status: 'UNKNOWN' as MangaPublicationStatus,
    lastFetch: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    coverExtraLarge: null,
    coverLarge: null,
    coverMedium: null,
    startDate: null,
    endDate: null,
    chapters: null,
    volumes: null,
    bannerImage: null,
    format: null,
    idMal: null,
    averageScore: null,
    popularity: null,
    countryOfOrigin: null,
    rating: null,
    publishers: [],
    contentRating: null,
    publicationDemographic: null,
    externalLinks: null,
    source: null,
    sourceId: null,
    galleryImages: [],
    fieldAlternatives: null,
    ...overrides
  };
}

/** Creates a manga with existing metadata for update tests */
export function createMangaWithMetadata(
  mangaOverrides?: Partial<Manga>,
  metadataOverrides?: Partial<Metadata>
): { manga: Manga; metadata: Metadata } {
  const metadata = createMockMetadata(metadataOverrides);
  const manga = createMockManga({ metadataId: metadata.id, ...mangaOverrides });
  return { manga, metadata };
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Safely extracts data from mock callback parameter */
export function extractData(param: unknown): unknown {
  if (isObject(param) && 'data' in param) {
    return param['data'];
  }
  return undefined;
}

/** Type guard for test object structure */
export function isTestObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Safely extracts nested data from Prisma operation parameters */
export function extractNestedData(param: unknown, key: string): unknown {
  const data = extractData(param);
  if (typeof data === 'object' && data !== null && key in data) {
    return (data as Record<string, unknown>)[key];
  }
  return undefined;
}

/** Creates a type-safe transaction implementation for prisma.$transaction mock */
export function createTransactionImplementation(
  mockTx: MockTransactionClient
): <T>(callback: (tx: MockTransactionClient) => Promise<T>) => Promise<T> {
  return async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => {
    return callback(mockTx);
  };
}

/** Sets up a transaction mock on the prisma object */
export function setupTransactionMock(
  prismaTransaction: jest.Mock,
  mockTx: MockTransactionClient
): void {
  prismaTransaction.mockImplementation(createTransactionImplementation(mockTx));
}

/** Creates a metadata capture mock implementation for create/update operations */
export function createMetadataCaptureImplementation(
  captureRef: { current: CapturedMetadataData | undefined },
  metadataId = 100
): (params: { data: CapturedMetadataData }) => Promise<{ id: number } & CapturedMetadataData> {
  return (params: { data: CapturedMetadataData }): Promise<{ id: number } & CapturedMetadataData> => {
    // eslint-disable-next-line no-param-reassign -- Intentional capture pattern for test assertions
    captureRef.current = params.data;
    return Promise.resolve({ id: metadataId, ...params.data });
  };
}

// ============================================================================
// Transaction Setup Helpers
// ============================================================================

/** Sets up a standard transaction mock for create operations */
export function setupCreateTransactionMock(
  transactionMock: jest.Mock,
  mockManga: Manga,
  onMetadataCreate?: (data: CapturedMetadataData) => void
): void {
  transactionMock.mockImplementation(
    <T>(callback: TransactionCallback<T>): Promise<T> => {
      const tx = createMockTransactionClient();
      tx.manga.findUnique.mockResolvedValue(mockManga);
      tx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100 });

      if (onMetadataCreate) {
        tx.metadata.create.mockImplementation(
          (params: { data: CapturedMetadataData }) => {
            onMetadataCreate(params.data);
            return Promise.resolve({ id: 100, ...params.data });
          }
        );
      } else {
        tx.metadata.create.mockResolvedValue({ id: 100 });
      }
      return callback(tx);
    }
  );
}

/** Sets up a standard transaction mock for update operations */
export function setupUpdateTransactionMock(
  transactionMock: jest.Mock,
  mockManga: Manga,
  existingMetadata: Metadata,
  onMetadataUpdate?: (data: CapturedMetadataData) => void
): void {
  transactionMock.mockImplementation(
    <T>(callback: TransactionCallback<T>): Promise<T> => {
      const tx = createMockTransactionClient();
      tx.manga.findUnique.mockResolvedValue({ ...mockManga, Metadata: existingMetadata });
      tx.manga.update.mockResolvedValue(mockManga);

      if (onMetadataUpdate) {
        tx.metadata.update.mockImplementation(
          (params: { data: CapturedMetadataData }) => {
            onMetadataUpdate(params.data);
            return Promise.resolve({ ...existingMetadata, ...params.data });
          }
        );
      } else {
        tx.metadata.update.mockResolvedValue(existingMetadata);
      }
      return callback(tx);
    }
  );
}
