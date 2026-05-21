/**
 * Zod schemas for third-party integration APIs
 *
 * Kavita, Komga, SABnzbd, Transmission, Deluge, etc.
 */

import { z } from 'zod';

// ============================================================================
// KAVITA
// ============================================================================

export const KavitaAuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
});

export type KavitaAuthResponse = z.infer<typeof KavitaAuthResponseSchema>;

export const KavitaServerInfoSchema = z.object({
  version: z.string(),
  installId: z.string().optional(),
  isDocker: z.boolean().optional(),
});

export type KavitaServerInfo = z.infer<typeof KavitaServerInfoSchema>;

export const KavitaSeriesSchema = z.object({
  id: z.number(),
  name: z.string(),
  originalName: z.string().optional(),
  localizedName: z.string().optional(),
  coverImage: z.string().optional(),
  pages: z.number().optional(),
  volumeCount: z.number().optional(),
});

export type KavitaSeries = z.infer<typeof KavitaSeriesSchema>;

// ============================================================================
// KOMGA
// ============================================================================

export const KomgaSeriesSchema = z.object({
  id: z.string(),
  libraryId: z.string(),
  name: z.string(),
  created: z.string().datetime().optional(),
  lastModified: z.string().datetime().optional(),
  booksCount: z.number(),
  metadata: z.object({
    status: z.string().optional(),
    title: z.string(),
    titleSort: z.string().optional(),
    summary: z.string().optional(),
    publisher: z.string().optional(),
    ageRating: z.number().optional(),
    language: z.string().optional(),
    genres: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type KomgaSeries = z.infer<typeof KomgaSeriesSchema>;

export const KomgaSeriesPageSchema = z.object({
  content: z.array(KomgaSeriesSchema),
  pageable: z.object({
    pageNumber: z.number(),
    pageSize: z.number(),
  }),
  totalElements: z.number(),
  totalPages: z.number(),
  last: z.boolean(),
});

export type KomgaSeriesPage = z.infer<typeof KomgaSeriesPageSchema>;

// ============================================================================
// SABNZBD
// ============================================================================

export const SABnzbdQueueItemSchema = z.object({
  nzo_id: z.string(),
  filename: z.string(),
  status: z.string(),
  percentage: z.string(),
  mb: z.string(),
  mbleft: z.string(),
  timeleft: z.string(),
  category: z.string().optional(),
});

export const SABnzbdResponseSchema = z.object({
  status: z.boolean().optional(),
  error: z.string().optional(),
  queue: z.object({
    slots: z.array(SABnzbdQueueItemSchema).optional(),
  }).optional(),
});

export type SABnzbdResponse = z.infer<typeof SABnzbdResponseSchema>;

// ============================================================================
// TRANSMISSION
// ============================================================================

export const TransmissionTorrentSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.number(),
  totalSize: z.number(),
  percentDone: z.number(),
  downloadDir: z.string(),
  isFinished: z.boolean(),
  hashString: z.string(),
});

export const TransmissionResponseSchema = z.object({
  result: z.string(),
  arguments: z.object({
    torrents: z.array(TransmissionTorrentSchema).optional(),
  }).optional(),
});

export type TransmissionResponse<T = unknown> = {
  result: string;
  arguments?: T;
};

// ============================================================================
// DELUGE
// ============================================================================

export const DelugeResponseSchema = z.object({
  id: z.number(),
  result: z.unknown(),
  error: z.object({
    message: z.string(),
    code: z.number(),
  }).optional(),
});

export type DelugeResponse<T = unknown> = {
  id: number;
  result: T;
  error?: {
    message: string;
    code: number;
  };
};

// ============================================================================
// Safe Parsers
// ============================================================================

export function parseKavitaAuthResponse(data: unknown): KavitaAuthResponse | null {
  const result = KavitaAuthResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Kavita auth response validation failed:', result.error.issues);
  return null;
}

export function parseKomgaSeriesPage(data: unknown): KomgaSeriesPage | null {
  const result = KomgaSeriesPageSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Komga series page validation failed:', result.error.issues);
  return null;
}

export function parseSABnzbdResponse(data: unknown): SABnzbdResponse | null {
  const result = SABnzbdResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('SABnzbd response validation failed:', result.error.issues);
  return null;
}
