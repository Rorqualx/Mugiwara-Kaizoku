/**
 * Reader Router - Utilities Module
 *
 * Shared helper functions, type definitions, and services
 * used across all reader modules.
 *
 * Extracted from: reader.ts (lines 1-91)
 */

import * as fs from 'fs/promises';
import * as path from 'path';


import { ChapterStatus } from '@prisma/client';

import { prisma as defaultPrisma } from '@/server/db';
import { hasMembership } from '@/server/trpc/routers/_shared/library-access';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { isObject, hasProperty } from '@/utils/type-guards';


import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extracts user ID from context
 *
 * @param ctx - The context object to extract user ID from
 * @returns The user ID as a string, or undefined if not found
 */
export function getUserId(ctx: unknown): string | undefined {
  if (!isObject(ctx) || !hasProperty(ctx, 'user')) {
    return undefined;
  }

  const user = ctx['user'];
  if (!isObject(user) || !hasProperty(user, 'id')) {
    return undefined;
  }

  const userId = user['id'];
  return typeof userId === 'string' || typeof userId === 'number'
    ? String(userId)
    : undefined;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Chapter file information
 */
export interface ChapterFileInfo {
  filePath: string | null;
  format: string;
  pageCount: number;
  title: string | null;
  chapterNumber: number;
  downloadStatus: ChapterStatus;
  /** Source type of active file ('chapter' | 'volume') */
  sourceType?: string | undefined;
  /** 1-indexed start page within archive (for volume files) */
  pageStart?: number | undefined;
  /** 1-indexed end page within archive (for volume files) */
  pageEnd?: number | undefined;
  /** Number of available file sources for this chapter */
  fileSourceCount?: number | undefined;
}

// ============================================================================
// Services
// ============================================================================

/**
 * File access service for chapter files
 */
export class FileAccessService {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env['MANGA_FILES_DIR'] ?? '/data/manga';
  }

  /**
   * Validates that a user has the given manga in their library.
   *
   * The catalog is a shared content layer; access is granted iff the user holds
   * a `LibraryMembership` for the title. This is the gate that stops one user
   * from reading another user's files via a guessed mangaId.
   *
   * @param userId - The user ID to check
   * @param mangaId - The manga ID being accessed
   * @returns True if the user has the title in their library
   */
  async validateAccess(userId: string | undefined, mangaId: number): Promise<boolean> {
    if (!userId) return false;
    return hasMembership(defaultPrisma, userId, mangaId);
  }

  /**
   * Retrieves a chapter file for a given user and manga
   *
   * @param userId - The user ID requesting the file
   * @param mangaId - The manga ID containing the chapter
   * @param chapterId - The chapter ID to retrieve
   * @param prisma - The Prisma client instance
   * @returns AsyncResult containing the file buffer or an error
   */
  async getChapterFile(
    userId: string | undefined,
    mangaId: number,
    chapterId: number,
    prisma: PrismaClient,
  ): Promise<AsyncResult<Buffer, Error>> {
    try {
      if (!userId) {
        return createErrorResult(new Error('Unauthorized'));
      }

      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { Manga: true },
      });

      if (!chapter || !chapter.filePath) {
        return createErrorResult(new Error('Chapter file not found'));
      }

      const hasAccess = await this.validateAccess(userId, mangaId);
      if (!hasAccess) {
        return createErrorResult(new Error('Access denied'));
      }

      const fullPath = path.isAbsolute(chapter.filePath)
        ? chapter.filePath
        : path.join(this.baseDir, chapter.filePath);

      const fileBuffer = await fs.readFile(fullPath);
      return createSuccessResult(fileBuffer);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to read file'),
      );
    }
  }
}

/**
 * Singleton instance of FileAccessService
 */
export const fileAccessService = new FileAccessService();
