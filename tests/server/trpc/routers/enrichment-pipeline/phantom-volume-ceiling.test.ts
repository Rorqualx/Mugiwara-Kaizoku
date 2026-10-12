/**
 * @jest-environment node
 *
 * The phantom pruners use the same volume cap as the volume writers.
 *
 * Bug protected: a finished series whose files outrun its counted volumes is
 * allowed one further volume. Reconciliation created it, then
 * removeEmptyPhantomVolumes deleted it as "numbered beyond the volume count"
 * because its chapters are linked only later in the run — Solo Leveling lost
 * volume 16 and 152 downloaded chapters had no volume after every refresh.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/server/db', () => ({
  prisma: {
    manga: { findUnique: jest.fn() },
    volume: { findMany: jest.fn(), deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/server/db';
import { removeEmptyPhantomVolumes } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-phantom-prune';

const mocked = prisma as unknown as {
  manga: { findUnique: jest.Mock };
  volume: { findMany: jest.Mock; deleteMany: jest.Mock };
  $queryRaw: jest.Mock;
};

function finishedSeries(filesPastLastVolume: boolean): void {
  mocked.manga.findUnique.mockResolvedValue({ publicationStatus: 'COMPLETED', Metadata: { endDate: null, volumes: 15 } } as never);
  mocked.$queryRaw.mockResolvedValue([
    { volumes: 15, status: 'COMPLETED', endDate: null, country: 'KR', format: 'MANGA', filesPastLastVolume },
  ] as never);
  mocked.volume.findMany.mockResolvedValue([
    { id: 116, number: 16, title: null },
    { id: 117, number: 17, title: null },
  ] as never);
  mocked.volume.deleteMany.mockResolvedValue({ count: 0 } as never);
}

describe('removeEmptyPhantomVolumes — volume ceiling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the one volume past the count that holds the files outrunning the volumes, and removes the one after it', async () => {
    finishedSeries(true);
    await removeEmptyPhantomVolumes(102);
    expect(mocked.volume.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [117] } } });
  });

  it('removes every empty volume past the count when no file runs past the last volume', async () => {
    finishedSeries(false);
    await removeEmptyPhantomVolumes(102);
    expect(mocked.volume.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [116, 117] } } });
  });
});
