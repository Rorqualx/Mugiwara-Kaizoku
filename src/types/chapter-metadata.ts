/**
 * Chapter Metadata Types
 * 
 * This file provides type definitions for chapter metadata operations
 * to improve type safety when updating chapter records.
 */

import type { ChapterStatus } from '@prisma/client';

/**
 * Chapter information from Fandom
 */
export interface FandomChapter {
  number: number;
  title: string;
  description?: string;
  volume?: number;
}

/**
 * Chapter update input for Prisma operations
 * with fields that can be updated
 */
export interface ChapterUpdateInput {
  title?: string;
  fileName?: string;
  index?: number;
  size?: number;
  downloadStatus?: ChapterStatus;
  language?: string;
  pageCount?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  resolutionLabel?: string;
  mangaId?: number;
  [key: string]: unknown;
}

/**
 * Chapter create input for Prisma operations
 * with required fields
 */
export interface ChapterCreateInput {
  mangaId: number;
  fileName: string;
  index?: number;
  title: string;
  size: number;
  downloadStatus: ChapterStatus;
  language?: string;
  pageCount?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  resolutionLabel?: string;
  [key: string]: unknown;
}