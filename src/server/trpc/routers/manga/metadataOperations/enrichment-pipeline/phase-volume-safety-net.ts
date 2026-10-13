/**
 * Phase 6 safety net: build the Volume rows chapters point at but no provider
 * rebuilt this run.
 *
 * Order matters. Chapters past the last provider-ranged volume that the
 * awaiting-volume rule tags -1 (file-less rows whose number names no volume,
 * see `@/lib/metadata/awaiting-volume`) are tagged BEFORE reconciliation, so
 * their leftover `Chapter.volume` cannot rebuild a volume no provider has
 * published. Reconciliation used to run first: it built the volume from that
 * number, and the tagger (which ran after) then emptied it. A next volume is
 * still built from chapters the rule leaves alone — file-backed rows keep the
 * number their import gave them.
 */

import { tagChaptersAwaitingVolume } from './phase-volume-overflow';
import { reassignNullNumberedVolumeArchives, reconcileMissingVolumeRecords } from './phase-volume-reconciliation';

export async function rebuildMissingVolumes(mangaId: number, expectedVolumeCount: number | null): Promise<void> {
  // NULL-numbered whole-volume archive rows go into their real volume first, so
  // they can't seed phantom "reconciliation" volumes (Dorohedoro v19-v23.zip → vols 24/25).
  await reassignNullNumberedVolumeArchives(mangaId);
  await tagChaptersAwaitingVolume(mangaId);
  await reconcileMissingVolumeRecords(mangaId, expectedVolumeCount);
}
