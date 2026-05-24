/**
 * Special / Decimal Chapter Placement
 *
 * Decimal chapters (5.5, 71.3, 400.5) belong inside the volume containing
 * their integer floor — NOT a synthetic "Specials" volume. Volume 0 used to
 * be the catch-all dumping ground for every decimal, which collided with
 * manga that have a legitimate published Volume 0 (Hunter x Hunter
 * "Kurapika's Memories", JJK 0).
 *
 * This module routes decimals to their sequential volume by floor()/ceil()
 * and only falls back to a "Specials" Vol 0 for true ch <= 0 orphans and
 * decimals with no parent volume in range. If a real Vol 0 already exists
 * (provider-supplied for a published prequel volume), its row is reused and
 * its title is left untouched.
 *
 * Why this is needed beyond applyVolumeRanges():
 *   applyVolumeRanges sets the `volume` scalar but NOT the `volumeId` FK.
 *   The legacy logic then misread `volumeId === null` as "range backfill
 *   failed" and dumped every decimal into Vol 0 — including ones that had
 *   already been correctly range-assigned.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

interface ChapterRow {
  id: number;
  chapterNumber: number | null;
  volume: number | null;
  volumeId: number | null;
  filePath: string | null;
}

interface RealVolume {
  id: number;
  number: number;
  chapterStart: number | null;
  chapterEnd: number | null;
}

/** Place decimal/special chapters into their proper sequential volume,
 *  falling back to a "Specials" Vol 0 only for true orphans. */
export async function assignSpecialChapters(mangaId: number, allChapters: ChapterRow[]): Promise<void> {
  const candidates = allChapters.filter(ch => ch.chapterNumber !== null);
  if (candidates.length === 0) return;

  // Pull Vol 0 separately — it's the natural home for 0.x decimals (HxH
  // "Kurapika's Memories" is Vol 0; ch 0.5 / 0.6 are its content). We do NOT
  // route 0.x decimals to Vol 1 via ceil()-fallback when a Vol 0 row exists.
  const vol0Row = await prisma.volume.findFirst({
    where: { mangaId, number: 0 },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
  });
  const realVolumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 }, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });

  const { decimalPlacements, orphans } = partitionPlacements(candidates, realVolumes, vol0Row);

  if (decimalPlacements.length > 0) {
    await Promise.all(
      decimalPlacements.map(p =>
        prisma.chapter.update({ where: { id: p.id }, data: { volume: p.volume, volumeId: p.volumeId } }),
      ),
    );
    logger.info(`[enrichmentPipeline] Placed ${decimalPlacements.length} decimal chapters in their sequential volumes`);
  }

  if (orphans.length === 0) return;
  await assignOrphansToSpecialsVolume(mangaId, orphans);
}

interface DecimalPlacement { id: number; volume: number; volumeId: number }

function partitionPlacements(
  candidates: ChapterRow[],
  realVolumes: RealVolume[],
  vol0Row: RealVolume | null,
): { decimalPlacements: DecimalPlacement[]; orphans: ChapterRow[] } {
  const decimalPlacements: DecimalPlacement[] = [];
  const orphans: ChapterRow[] = [];
  for (const ch of candidates) {
    const cn = ch.chapterNumber as number;
    if (cn <= 0) {
      if (ch.volumeId === null || ch.volume === null) orphans.push(ch);
      continue;
    }
    if (Number.isInteger(cn)) continue;
    const placement = findSequentialVolumeForDecimal(cn, realVolumes, vol0Row);
    if (placement) {
      if (ch.volume !== placement.number || ch.volumeId !== placement.id) {
        decimalPlacements.push({ id: ch.id, volume: placement.number, volumeId: placement.id });
      }
      continue;
    }
    if (ch.volumeId === null) orphans.push(ch);
  }
  return { decimalPlacements, orphans };
}

async function assignOrphansToSpecialsVolume(mangaId: number, orphans: ChapterRow[]): Promise<void> {
  const existingVol0 = await prisma.volume.findFirst({ where: { mangaId, number: 0 }, select: { id: true } });
  const vol0 = existingVol0 ?? await prisma.volume.create({
    data: { mangaId, number: 0, title: 'Specials' },
    select: { id: true },
  });

  const ids = orphans.map(ch => ch.id);
  await prisma.chapter.updateMany({
    where: { id: { in: ids } },
    data: { volume: 0, volumeId: vol0.id },
  });
  logger.info(`[enrichmentPipeline] Assigned ${ids.length} orphan specials (ch<=0 or no-parent decimals) to Vol 0`);
}

/** Find the volume containing floor(chapterNum). For floor()=0 with a Vol 0
 *  row present, prefers Vol 0 (where 0.x decimals belong — HxH "Kurapika's
 *  Memories" Part 1/2 are chapter 0.5/0.6 of Vol 0, not bonus chapters of
 *  Vol 1). Only falls back to ceil() when no Vol 0 row exists. */
function findSequentialVolumeForDecimal(
  chapterNum: number,
  volumes: RealVolume[],
  vol0Row: RealVolume | null,
): { id: number; number: number } | null {
  const floor = Math.floor(chapterNum);
  if (floor === 0 && vol0Row) {
    return { id: vol0Row.id, number: vol0Row.number };
  }
  for (const v of volumes) {
    if (v.chapterStart === null || v.chapterEnd === null) continue;
    if (floor >= v.chapterStart && floor <= v.chapterEnd) return { id: v.id, number: v.number };
  }
  if (vol0Row) return null;
  const ceil = Math.ceil(chapterNum);
  for (const v of volumes) {
    if (v.chapterStart === null || v.chapterEnd === null) continue;
    if (ceil >= v.chapterStart && ceil <= v.chapterEnd) return { id: v.id, number: v.number };
  }
  return null;
}
