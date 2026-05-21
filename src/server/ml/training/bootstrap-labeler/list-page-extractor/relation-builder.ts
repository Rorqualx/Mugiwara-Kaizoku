/**
 * Relation Builder for Chapter-Volume Tuples
 *
 * Builds explicit ChapterVolumeRelation tuples from extracted data.
 * These tuples are used for relation extraction ML training.
 */

import type { ChapterExtraction, ChapterVolumeRelation, RelationSourceType, VolumeExtraction } from './types';

// ============================================================================
// Confidence Configuration
// ============================================================================

/** Base confidence by relation source */
const SOURCE_CONFIDENCE: Record<RelationSourceType, number> = {
  SAME_TABLE_ROW: 0.95, // Chapter and volume in same row - very reliable
  VOLUME_SECTION: 0.85, // Chapter under volume header - reliable
  EXPLICIT_LABEL: 0.90, // "Vol. X" text in chapter row - reliable
  INFERRED: 0.70, // Derived from chapter ranges - less certain
};

// ============================================================================
// Relation Building
// ============================================================================

/**
 * Build chapter-volume relation tuples from extracted data
 */
export function buildRelations(
  chapters: ChapterExtraction[],
  volumes: VolumeExtraction[]
): ChapterVolumeRelation[] {
  const relations: ChapterVolumeRelation[] = [];

  // Create a map of volume numbers to their token indices
  const volumeTokenMap = new Map<number, number>();
  for (const volume of volumes) {
    if (volume.tokenSpans.number) {
      volumeTokenMap.set(volume.volumeNumber, volume.tokenSpans.number.start);
    }
  }

  // Build relations for each chapter that has a volume assignment
  for (const chapter of chapters) {
    const relation = buildSingleRelation(chapter, volumeTokenMap);
    if (relation) {
      relations.push(relation);
    }
  }

  return relations;
}

/**
 * Build a single relation for a chapter
 */
function buildSingleRelation(
  chapter: ChapterExtraction,
  volumeTokenMap: Map<number, number>
): ChapterVolumeRelation | null {
  if (chapter.belongsToVolume === undefined) return null;

  const volumeTokenIndex = volumeTokenMap.get(chapter.belongsToVolume);
  const chapterTokenIndex = chapter.tokenSpans.number?.start;

  // Skip if we don't have token positions (can't create proper relation)
  if (volumeTokenIndex === undefined || chapterTokenIndex === undefined) return null;

  const confidence = calculateRelationConfidence(chapter, true);

  return {
    chapterNumber: chapter.chapterNumber,
    volumeNumber: chapter.belongsToVolume,
    chapterTokenIndex,
    volumeTokenIndex,
    source: chapter.relationSource,
    confidence,
  };
}

/**
 * Calculate confidence score for a relation
 */
function calculateRelationConfidence(chapter: ChapterExtraction, hasVolumeToken: boolean): number {
  // Base confidence from relation source
  let confidence = SOURCE_CONFIDENCE[chapter.relationSource];

  // Boost if we have both token positions
  if (hasVolumeToken && chapter.tokenSpans.number) {
    confidence = Math.min(1.0, confidence + 0.05);
  }

  // Slight penalty if chapter has no URL (less verifiable)
  if (!chapter.url) {
    confidence = Math.max(0.3, confidence - 0.05);
  }

  return confidence;
}

// ============================================================================
// Relation Validation
// ============================================================================

/**
 * Check for duplicate chapter assignments to different volumes
 */
function checkDuplicateAssignments(relations: ChapterVolumeRelation[]): string[] {
  const issues: string[] = [];
  const chapterVolumes = new Map<number, Set<number>>();

  for (const relation of relations) {
    const existing = chapterVolumes.get(relation.chapterNumber) ?? new Set<number>();
    existing.add(relation.volumeNumber);
    chapterVolumes.set(relation.chapterNumber, existing);
  }

  for (const [chapterNum, volumeNums] of chapterVolumes) {
    if (volumeNums.size > 1) {
      issues.push(`Chapter ${chapterNum} assigned to multiple volumes: ${[...volumeNums].join(', ')}`);
    }
  }

  return issues;
}

/**
 * Check that assigned volumes exist
 */
function checkVolumeExistence(relations: ChapterVolumeRelation[], volumes: VolumeExtraction[]): string[] {
  const issues: string[] = [];
  const volumeNumbers = new Set(volumes.map((v) => v.volumeNumber));

  for (const relation of relations) {
    if (!volumeNumbers.has(relation.volumeNumber)) {
      issues.push(`Chapter ${relation.chapterNumber} references non-existent volume ${relation.volumeNumber}`);
    }
  }

  return issues;
}

/**
 * Check for large gaps in chapter sequences within volumes
 */
function checkChapterSequenceGaps(relations: ChapterVolumeRelation[]): string[] {
  const issues: string[] = [];
  const volumeChapters = new Map<number, number[]>();

  for (const relation of relations) {
    const existing = volumeChapters.get(relation.volumeNumber) ?? [];
    existing.push(relation.chapterNumber);
    volumeChapters.set(relation.volumeNumber, existing);
  }

  for (const [volumeNum, chapNums] of volumeChapters) {
    const gapIssues = findSequenceGaps(volumeNum, chapNums);
    issues.push(...gapIssues);
  }

  return issues;
}

/**
 * Find gaps in a chapter sequence for a volume
 */
function findSequenceGaps(volumeNum: number, chapNums: number[]): string[] {
  const issues: string[] = [];
  const sorted = [...chapNums].sort((a, b) => a - b);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev !== undefined && curr !== undefined) {
      const gap = curr - prev;
      // Flag large gaps (more than 5 chapters missing)
      if (gap > 5) {
        issues.push(`Volume ${volumeNum} has gap between chapters ${prev} and ${curr}`);
      }
    }
  }

  return issues;
}

/**
 * Validate relations for consistency
 */
export function validateRelations(
  relations: ChapterVolumeRelation[],
  volumes: VolumeExtraction[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [
    ...checkDuplicateAssignments(relations),
    ...checkVolumeExistence(relations, volumes),
    ...checkChapterSequenceGaps(relations),
  ];

  return { valid: issues.length === 0, issues };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Calculate relation statistics
 */
export function calculateRelationStats(
  relations: ChapterVolumeRelation[],
  totalChapters: number
): {
  totalRelations: number;
  assignedChapters: number;
  unassignedChapters: number;
  bySource: Record<RelationSourceType, number>;
  avgConfidence: number;
} {
  const bySource: Record<RelationSourceType, number> = {
    SAME_TABLE_ROW: 0,
    VOLUME_SECTION: 0,
    EXPLICIT_LABEL: 0,
    INFERRED: 0,
  };

  let totalConfidence = 0;
  for (const relation of relations) {
    bySource[relation.source] = bySource[relation.source] + 1;
    totalConfidence += relation.confidence;
  }

  const assignedChapters = new Set(relations.map((r) => r.chapterNumber)).size;

  return {
    totalRelations: relations.length,
    assignedChapters,
    unassignedChapters: totalChapters - assignedChapters,
    bySource,
    avgConfidence: relations.length > 0 ? totalConfidence / relations.length : 0,
  };
}
