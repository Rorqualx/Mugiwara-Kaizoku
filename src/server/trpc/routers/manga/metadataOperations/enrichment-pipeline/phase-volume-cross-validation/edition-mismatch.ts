/**
 * Edition mismatch guard
 *
 * ComicVine often lists a collected edition (2-in-1 hardcovers, omnibus
 * "Books") under the same series name. Its volume N then covers far more
 * chapters than volume N of the tankobon edition every other source
 * describes. Those ranges are internally consistent and read straight from
 * the description, so they carry the highest confidence and would overwrite
 * the tankobon layout for the first N volumes.
 */

import { logger } from '@/utils/logger';

import type { VolumeRangeProposal } from '../phase-volume-cross-validation';

const log = logger.child('VolumeCrossValidation');

/** Another source must describe at least this many times more volumes. */
const MORE_VOLUMES_RATIO = 1.3;
/** ComicVine's last volume must end at least this many times further in. */
const FURTHER_ALONG_RATIO = 1.3;
/** ...and by at least this many chapters, so short series are not caught by rounding. */
const MIN_CHAPTER_LEAD = 5;

interface SourceShape {
  lastVolume: number;
  endByVolume: Map<number, number>;
}

function shapeOf(proposals: VolumeRangeProposal[]): SourceShape {
  const endByVolume = new Map<number, number>();
  let lastVolume = 0;
  for (const p of proposals) {
    endByVolume.set(p.volumeNumber, Math.max(endByVolume.get(p.volumeNumber) ?? 0, p.chapterEnd));
    if (p.volumeNumber > lastVolume) lastVolume = p.volumeNumber;
  }
  return { lastVolume, endByVolume };
}

/**
 * Drop ComicVine's proposals when they describe a different edition than
 * another source: fewer volumes, each reaching much further into the series.
 * A ComicVine listing that merely lags behind (same edition, fewer volumes
 * out) ends its last volume where the other source's same volume ends, and
 * is kept.
 */
export function dropDifferentEditionComicVine(proposals: VolumeRangeProposal[]): VolumeRangeProposal[] {
  const comicvine = proposals.filter(p => p.source === 'comicvine');
  if (comicvine.length < 2) return proposals;

  const cv = shapeOf(comicvine);
  const cvEnd = cv.endByVolume.get(cv.lastVolume) ?? 0;

  for (const source of ['mangadex', 'wikipedia', 'fandom'] as const) {
    const other = shapeOf(proposals.filter(p => p.source === source));
    const otherEnd = other.endByVolume.get(cv.lastVolume);
    if (otherEnd === undefined || other.lastVolume < cv.lastVolume * MORE_VOLUMES_RATIO) continue;
    if (cvEnd >= otherEnd * FURTHER_ALONG_RATIO && cvEnd - otherEnd >= MIN_CHAPTER_LEAD) {
      log.info('ComicVine describes a different edition — ignoring its volume ranges', {
        comicvineVolumes: cv.lastVolume,
        comicvineLastEnd: cvEnd,
        comparedWith: source,
        otherVolumes: other.lastVolume,
        otherEndAtSameVolume: otherEnd,
      });
      return proposals.filter(p => p.source !== 'comicvine');
    }
  }
  return proposals;
}
