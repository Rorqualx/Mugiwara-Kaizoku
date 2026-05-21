/**
 * Metadata Validation Schemas
 *
 * This module contains all Zod schemas and type definitions for metadata validation.
 * It provides the core schema definitions that are used by validators and normalization functions.
 */

import { MangaPublicationStatus, ContentRating, PublicationDemographic } from '@prisma/client';
import { z } from 'zod';


// Zod schema for AuthorInfo
export const authorInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  role: z.string().optional(),
  imageUrl: z.string().optional()
}) as z.ZodObject<{
  id: z.ZodOptional<z.ZodString>;
  name: z.ZodString;
  role: z.ZodOptional<z.ZodString>;
  imageUrl: z.ZodOptional<z.ZodString>;
}>;

// Zod schema for RelatedLink
export const relatedLinkSchema = z.object({
  url: z.string().url(),
  label: z.string(),
  type: z.string().optional()
}) as z.ZodObject<{
  url: z.ZodString;
  label: z.ZodString;
  type: z.ZodOptional<z.ZodString>;
}>;

// Zod schema for NormalizedMetadata
export const metadataSchema = z.object({
  // Required fields
  id: z.string(),
  providerId: z.string(),
  title: z.string(),

  // Optional core metadata
  alternativeTitles: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(MangaPublicationStatus).optional(),
  contentRating: z.nativeEnum(ContentRating).optional(),
  demographic: z.nativeEnum(PublicationDemographic).optional(),

  // Counts and measurements
  volumes: z.number().optional(),
  chapters: z.number().optional(),
  pages: z.number().optional(),

  // Visual assets
  coverImage: z.string().optional(),
  coverImageThumbnail: z.string().optional(),
  bannerImage: z.string().optional(),

  // Classification
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),

  // Creators
  authors: z.array(authorInfoSchema).optional(),
  artists: z.array(authorInfoSchema).optional(),

  // Timeline
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),

  // Popularity metrics
  score: z.number().optional(),
  popularity: z.number().optional(),

  // External references
  sourceUrl: z.string().optional(),
  relatedLinks: z.array(relatedLinkSchema).optional(),

  // Provider-specific data
  providerSpecific: z.record(z.unknown()).optional(),

  // Metadata management
  metadataUpdatedAt: z.date().optional(),
  metadataSource: z.string().optional()
});

// Zod schema for NormalizedChapter
export const chapterSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  mangaId: z.string(),

  title: z.string().optional(),
  chapterNumber: z.union([z.string(), z.number()]).optional(),
  volumeNumber: z.union([z.string(), z.number()]).optional(),
  language: z.string().optional(),

  pages: z.number().optional(),
  pageUrls: z.array(z.string()).optional(),

  publishDate: z.union([z.string(), z.date()]).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),

  providerSpecific: z.record(z.unknown()).optional()
});

// Type definitions inferred from schemas
export type NormalizedMetadata = z.infer<typeof metadataSchema>;
export type NormalizedChapter = z.infer<typeof chapterSchema>;