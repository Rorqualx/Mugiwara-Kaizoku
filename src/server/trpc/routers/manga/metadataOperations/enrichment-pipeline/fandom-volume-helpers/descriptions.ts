/**
 * Volume description updates from Fandom
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/** Update Volume records with English descriptions from Fandom */
export async function updateVolumeDescriptions(
  mangaId: number,
  volumeDescriptionMap: Record<number, string>,
): Promise<void> {
  const entries = Object.entries(volumeDescriptionMap);
  if (entries.length === 0) return;

  let updated = 0;
  for (const [volNumStr, description] of entries) {
    const volNum = Number(volNumStr);
    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume descriptions
    const res = await prisma.volume.updateMany({
      where: { mangaId, number: volNum },
      data: { description },
    });
    if (res.count > 0) updated++;
  }
  logger.info(`[enrichmentPipeline] Updated ${updated} volumes with English descriptions from Fandom`);
}