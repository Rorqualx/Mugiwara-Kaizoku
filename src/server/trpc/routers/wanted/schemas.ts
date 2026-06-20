/**
 * Shared Zod input schemas and helper types for the wanted router.
 */

import { WantedPriority, WantedStatus, DownloadHistoryStatus } from '@prisma/client';
import { z } from 'zod';

import { toNumberId } from '@/utils/id-converters';

export interface PrismaWhereClause {
  status?: { in: WantedStatus[] } | { in: DownloadHistoryStatus[] } | undefined;
  priority?: { in: WantedPriority[] } | undefined;
  /** Owner scope for DownloadHistory reads (per-user isolation). */
  initiatedByUserId?: string | undefined;
  dateAdded?: { gte: Date; lte: Date } | undefined;
  startTime?: { gte: Date; lte: Date } | undefined;
  source?: { in: string[] } | undefined;
  downloadClient?: { in: string[] } | undefined;
  OR?: Array<{
    metadata: {
      path: string[];
      string_contains: string;
    };
  }> | undefined;
}

export const wantedSearchSchema = z.object({
  status: z.array(z.nativeEnum(WantedStatus)).optional(),
  priority: z.array(z.nativeEnum(WantedPriority)).optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional(),
  searchTerm: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
});

export const createWantedItemSchema = z.object({
  mangaId: z.union([z.string(), z.number()]).transform((val) => toNumberId(val)),
  chapterId: z.union([z.string(), z.number()]).transform((val) => toNumberId(val)).optional(),
  priority: z.nativeEnum(WantedPriority).default(WantedPriority.NORMAL),
  metadata: z.object({
    title: z.string(),
    chapterNumber: z.string().optional(),
    language: z.string().optional(),
    preferredSource: z.string().optional(),
    qualityProfile: z.string().optional()
  }).optional()
});

export const updateWantedItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((val) => toNumberId(val)),
  priority: z.nativeEnum(WantedPriority).optional(),
  status: z.nativeEnum(WantedStatus).optional()
});

export const missingSearchSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(500).default(100)
});

export const downloadHistorySearchSchema = z.object({
  status: z.array(z.nativeEnum(DownloadHistoryStatus)).optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional(),
  source: z.array(z.string()).optional(),
  downloadClient: z.array(z.string()).optional(),
  searchTerm: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
});
