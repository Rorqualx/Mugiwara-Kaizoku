import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { ValidationError } from '@/utils/errors';
import { serverLogger } from '@/utils/serverLogger';

import type { Manga, Metadata } from '@prisma/client';
/**
 * Interface for manga with metadata
 */
interface MangaWithMetadata extends Manga {
  Metadata: Metadata | null;
}
/**
 * Result of duplicate detection
 */
export interface DuplicateResult {
  manga: MangaWithMetadata;
  score: number;
  matchType: 'exact' | 'normalized' | 'partial' | 'metadata';
  matchedOn: string[];
}
/**
 * Service for detecting duplicate manga in a library
 */
export class DuplicateDetector {
  /**
   * Find potential duplicate manga based on title
   */
  async findDuplicates(title: string, libraryId: number, options: {
    checkMetadata?: boolean;
    minSimilarity?: number;
  } = {}): Promise<DuplicateResult[]> {
    const { checkMetadata = true, minSimilarity = 0.7 } = options;
    try {
      // Normalize the title for searching
      const normalizedTitle = this.normalizeTitle(title);
      const searchTerms = this.generateSearchTerms(normalizedTitle);
      // Find candidates
      const candidates = await prisma.manga.findMany({
        where: {
          libraryId,
          OR: this.buildSearchConditions(title, normalizedTitle, searchTerms)
        },
        include: {
          Metadata: checkMetadata
        }
      });
      // Score and rank candidates
      const results: DuplicateResult[] = [];
      for (const candidate of candidates) {
        const result = this.scoreCandidate(candidate, title, normalizedTitle);
        if (result.score >= minSimilarity) {
          results.push(result);
        }
      }
      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
      serverLogger.info('Duplicate detection completed', {
        originalTitle: title,
        candidatesFound: candidates.length,
        duplicatesFound: results.length
      });

      // Emit WebSocket event for real-time UI sync if duplicates found
      if (results.length > 0) {
        void realtimeEmitter.emitSystemEvent({
          eventType: 'library:duplicates:detected',
          source: 'DuplicateDetector',
          message: `Found ${results.length} potential duplicate(s) for "${title}"`,
          data: {
            libraryId,
            title,
            duplicatesCount: results.length,
            candidatesChecked: candidates.length
          }
        });
      }

      return results;
    }
    catch (error: unknown) {
      serverLogger.error('Error in duplicate detection', {
        title,
        libraryId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  /**
   * Check if a specific manga is a duplicate
   */
  async isDuplicate(title: string, libraryId: number, excludeMangaId?: number): Promise<boolean> {
    const duplicates = await this.findDuplicates(title, libraryId);
    if (excludeMangaId) {
      return duplicates.some((d) => d.manga["id"] !== excludeMangaId);
    }
    return duplicates.length > 0;
  }
  /**
   * Find duplicates by external provider ID
   * Note: This method currently cannot search by provider/providerId as the Metadata
   * model doesn't have these fields. It searches by source and sourceId instead.
   */
  async findByProviderId(provider: string, providerId: string, libraryId: number): Promise<MangaWithMetadata | null> {
    const manga = await prisma.manga.findFirst({
      where: {
        libraryId,
        Metadata: {
          source: provider,
          sourceId: providerId
        }
      },
      include: {
        Metadata: true
      }
    });
    return manga;
  }
  /**
   * Build search conditions for finding duplicates
   */
  private buildSearchConditions(originalTitle: string, normalizedTitle: string, searchTerms: string[]): Array<{ title: { equals?: string; contains?: string; mode: 'insensitive' } }> {
    const conditions = [
    // Exact title match (case insensitive)
    { title: { equals: originalTitle, mode: 'insensitive' as const } },
    // Normalized title match
    { title: { equals: normalizedTitle, mode: 'insensitive' as const } },
    // Contains normalized title
    { title: { contains: normalizedTitle, mode: 'insensitive' as const } },
    // Search terms
    ...searchTerms.map((term) => ({
      title: { contains: term, mode: 'insensitive' as const }
    }))];

    return conditions;
  }
  /**
   * Score a candidate manga for similarity
   */
  private scoreCandidate(candidate: MangaWithMetadata, originalTitle: string, normalizedTitle: string): DuplicateResult {
    const candidateNormalized = this.normalizeTitle(candidate["title"]);
    let score = 0;
    const matchedOn: string[] = [];
    let matchType: DuplicateResult['matchType'] = 'partial';
    // Exact match
    if (candidate["title"].toLowerCase() === originalTitle.toLowerCase()) {
      score = 1.0;
      matchType = 'exact';
      matchedOn.push('exact_title');
    }
    // Normalized match
    else if (candidateNormalized === normalizedTitle) {
      score = 0.95;
      matchType = 'normalized';
      matchedOn.push('normalized_title');
    }
    // Calculate similarity score
    else {
      score = this.calculateSimilarity(normalizedTitle, candidateNormalized);
      if (score >= 0.8) {
        matchType = 'normalized';
        matchedOn.push('high_similarity');
      } else
      {
        matchType = 'partial';
        matchedOn.push('partial_match');
      }
    }
    // Check metadata for alternative titles (synonyms)
    if (candidate.Metadata?.synonyms && candidate.Metadata.synonyms.length > 0) {
      for (const altTitle of candidate.Metadata.synonyms) {
        const altNormalized = this.normalizeTitle(altTitle);
        if (altNormalized === normalizedTitle) {
          score = Math.max(score, 0.9);
          matchType = 'metadata';
          matchedOn.push('alternative_title');
          break;
        }
      }
    }
    return {
      manga: candidate,
      score,
      matchType,
      matchedOn
    };
  }
  /**
   * Normalize a title for comparison
   */
  private normalizeTitle(title: string): string {
    return title.
    toLowerCase()
    // Remove special characters except spaces
    .replace(/[^\w\s]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove common words
    .replace(/\b(the|a|an|and|or|of|in|on|at|to|for)\b/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ').
    trim();
  }
  /**
   * Generate search terms from a title
   */
  private generateSearchTerms(normalizedTitle: string): string[] {
    const words = normalizedTitle.split(' ').filter((w) => w.length > 2);
    const terms: string[] = [];
    // Add the full normalized title
    if (normalizedTitle.length > 3) {
      terms.push(normalizedTitle);
    }
    // Add significant word combinations
    if (words.length >= 2) {
      // First two words
      terms.push(words.slice(0, 2).join(' '));
      // Last two words (if different)
      if (words.length > 2) {
        terms.push(words.slice(-2).join(' '));
      }
      // First and last word (for titles like "Attack on Titan")
      if (words.length >= 3) {
        terms.push(`${words[0]} ${words[words.length - 1]}`);
      }
    }
    // Add individual significant words
    const significantWords = words.filter((w) => w.length > 4);
    terms.push(...significantWords);
    // Remove duplicates
    return [...new Set(terms)];
  }
  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) {
      return 1.0;
    }
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  /**
   * Calculate single matrix cell value for Levenshtein distance
   */
  private calculateMatrixCell(options: {
    str1: string;
    str2: string;
    i: number;
    j: number;
    currentRow: number[];
    prevRow: number[];
  }): number | undefined {
    const { str1, str2, i, j, currentRow, prevRow } = options;

    if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
      const prevDiag = prevRow[j - 1];
      return prevDiag;
    }

    const prevDiag = prevRow[j - 1];
    const prevLeft = currentRow[j - 1];
    const prevUp = prevRow[j];

    if (prevDiag !== undefined && prevLeft !== undefined && prevUp !== undefined) {
      return Math.min(
        prevDiag + 1, // substitution
        prevLeft + 1, // insertion
        prevUp + 1 // deletion
      );
    }

    return undefined;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    // Initialize first row
    const firstRow = matrix[0];
    if (firstRow !== undefined) {
      for (let j = 0; j <= str1.length; j++) {
        firstRow[j] = j;
      }
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];

        if (currentRow !== undefined && prevRow !== undefined) {
          const cellValue = this.calculateMatrixCell({
            str1,
            str2,
            i,
            j,
            currentRow,
            prevRow
          });
          if (cellValue !== undefined) {
            currentRow[j] = cellValue;
          }
        }
      }
    }

    const lastRow = matrix[str2.length];
    const result = lastRow?.[str1.length];
    return result ?? 0;
  }
  /**
   * Merge duplicate manga entries
   */
  async mergeDuplicates(keepMangaId: number, mergeFromIds: number[]): Promise<void> {
    try {
      // Update all chapters to point to the kept manga
      await prisma.chapter.updateMany({
        where: {
          mangaId: { in: mergeFromIds }
        },
        data: {
          mangaId: keepMangaId
        }
      });
      // Move all metadata (avoiding duplicates)
      const keepManga = await prisma.manga.findUnique({
        where: { id: keepMangaId },
        include: { Metadata: true }
      });
      if (!keepManga) {
        throw new ValidationError('Target manga not found');
      }
      // Move metadata from duplicates if keepManga doesn't have metadata
      if (!keepManga.Metadata) {
        // Find a manga with metadata to use
        const mangaWithMetadata = await prisma.manga.findFirst({
          where: {
            id: { in: mergeFromIds },
            metadataId: { not: null }
          },
          include: { Metadata: true }
        });
        if (mangaWithMetadata?.Metadata) {
          // Update the kept manga to use this metadata
          await prisma.manga.update({
            where: { id: keepMangaId },
            data: { metadataId: mangaWithMetadata.metadataId }
          });
        }
      }
      // Delete the duplicate manga entries
      await prisma.manga.deleteMany({
        where: {
          id: { in: mergeFromIds }
        }
      });
      serverLogger.info('Merged duplicate manga', {
        keptId: keepMangaId,
        mergedIds: mergeFromIds
      });

      // Emit WebSocket event for real-time UI sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId: keepMangaId,
        action: 'updated',
        data: {
          duplicatesMerged: true,
          mergedFromIds: mergeFromIds,
          mergedCount: mergeFromIds.length,
          source: 'duplicate-detector'
        }
      });

      // Also emit deletion events for the merged (deleted) manga
      for (const mergedId of mergeFromIds) {
        void realtimeEmitter.emitMangaUpdate({
          mangaId: mergedId,
          action: 'deleted',
          data: {
            mergedIntoId: keepMangaId,
            source: 'duplicate-detector'
          }
        });
      }
    }
    catch (error: unknown) {
      serverLogger.error('Error merging duplicates', {
        keepMangaId,
        mergeFromIds,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}