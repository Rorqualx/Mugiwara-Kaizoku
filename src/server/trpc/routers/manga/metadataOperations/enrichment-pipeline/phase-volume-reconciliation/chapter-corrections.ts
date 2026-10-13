/**
 * Per-chapter volume correction plan for `correctVolumeAssignments`.
 */

import { isAwaitingVolume } from '@/lib/metadata/awaiting-volume';

import { extractVolumeNumberFromFileName, isVolumeFileName } from './null-row-volume';

/** Classify each chapter as needing correction, orphan unlinking, or no action */
// eslint-disable-next-line complexity -- complexity 22: per-chapter classification considers chapterNumber/volume/volumeId/filePath/fileName + correctionMap + confidence threshold; each branch maps to one of 3 distinct outcomes
export function classifyChapterCorrections(
  chapters: Array<{ chapterNumber: number | null; volume: number | null; volumeId: number | null; filePath: string | null; fileName: string | null }>,
  chapterToCorrectVolume: Map<number, number>,
  volumeNumberToId: Map<number, number>,
  isHighConfidence: boolean,
): { corrections: Map<number, number[]>; orphanedChapterNumbers: number[] } {
  const corrections = new Map<number, number[]>();
  const orphanedChapterNumbers: number[] = [];

  for (const ch of chapters) {
    if (ch.chapterNumber === null) continue;

    // Volume files: assign to the volume from their filename, not from chapter ranges
    if (ch.filePath !== null && isVolumeFileName(ch.fileName)) {
      const fileVolNum = extractVolumeNumberFromFileName(ch.fileName ?? '');
      if (fileVolNum !== null && ch.volume !== fileVolNum) {
        const arr = corrections.get(fileVolNum) ?? [];
        arr.push(ch.chapterNumber);
        corrections.set(fileVolNum, arr);
      }
      continue;
    }

    // File-backed chapter files with existing volume: import pipeline is authoritative
    if (ch.filePath !== null && ch.volume !== null) continue;
    const correctVol = chapterToCorrectVolume.get(ch.chapterNumber);

    if (correctVol === undefined) {
      // No Volume record covers this chapter — unlink if it has a stale assignment.
      // Only for high-confidence ranges; low-confidence ranges may be wrong.
      // A chapter awaiting its volume (-1) is already in the right state; unlinking
      // it only made the overflow pass tag it again on every run.
      if (isHighConfidence && ch.volume !== null && !isAwaitingVolume(ch.volume)) {
        orphanedChapterNumbers.push(ch.chapterNumber);
      }
      continue;
    }

    const correctVolId = volumeNumberToId.get(correctVol);
    if (ch.volume !== correctVol || ch.volumeId !== correctVolId) {
      // High confidence: reassign wrong volumes + assign null chapters.
      // Low confidence: only assign chapters that are currently unassigned.
      // Either confidence: backfill a null volumeId when the existing volume
      //   number is correct — this is a pure FK fill, no semantic change.
      const volumeAlreadyCorrect = ch.volume === correctVol;
      const needsFkBackfill = volumeAlreadyCorrect && ch.volumeId === null && correctVolId !== undefined;
      if (isHighConfidence || ch.volume === null || needsFkBackfill) {
        const arr = corrections.get(correctVol) ?? [];
        arr.push(ch.chapterNumber);
        corrections.set(correctVol, arr);
      }
    }
  }

  return { corrections, orphanedChapterNumbers };
}
